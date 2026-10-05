"use server";

import { revalidatePath } from 'next/cache';
import { dbQuery } from '@/lib/db';
import { adminCredentials, createSession, deleteSession } from '@/lib/auth';
import { constantTimeEqual, hashPassword, normalizeEmail, validEmail, verifyPassword } from '@/lib/auth-utils';

type AuthResult = { success: true } | { success: false; error: string };

interface Account {
  id: number;
  password_hash: string;
  role: 'student' | 'admin';
}

async function allowAttempt(email: string) {
  const [attempt] = await dbQuery<{ attempts: number }>(
    `INSERT INTO auth_attempts (email, attempts) VALUES ($1, 1)
     ON CONFLICT (email) DO UPDATE SET
       attempts = CASE WHEN auth_attempts.window_started_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
         THEN 1 ELSE auth_attempts.attempts + 1 END,
       window_started_at = CASE WHEN auth_attempts.window_started_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
         THEN CURRENT_TIMESTAMP ELSE auth_attempts.window_started_at END
     RETURNING attempts`, [email],
  );
  return attempt.attempts <= 10;
}

async function authenticate(emailInput: string, password: string, mode: 'login' | 'register' | 'admin'): Promise<AuthResult> {
  const email = normalizeEmail(emailInput);
  if (!validEmail(email) || password.length < 8 || password.length > 128) {
    return { success: false, error: 'Ingresa un correo válido y una contraseña de 8 a 128 caracteres.' };
  }
  try {
    const admin = adminCredentials();
    if (!await allowAttempt(email)) {
      return { success: false, error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' };
    }

    let account: Account | undefined;
    if (mode === 'register') {
      if (email === admin.email) return { success: false, error: 'Este correo está reservado para el administrador.' };
      const passwordHash = await hashPassword(password);
      [account] = await dbQuery<Account>(
        `INSERT INTO app_users (email, password_hash, role) VALUES ($1, $2, 'student')
         ON CONFLICT (email) DO NOTHING RETURNING id, password_hash, role`,
        [email, passwordHash],
      );
      if (!account) return { success: false, error: 'No se pudo registrar este correo. Si ya tienes cuenta, inicia sesión.' };
    } else if (mode === 'admin' || email === admin.email) {
      if (email !== admin.email || !constantTimeEqual(password, admin.password)) {
        return { success: false, error: 'Correo o contraseña incorrectos.' };
      }
      const passwordHash = await hashPassword(password);
      [account] = await dbQuery<Account>(
        `INSERT INTO app_users (email, password_hash, role) VALUES ($1, $2, 'admin')
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         WHERE app_users.role = 'admin' RETURNING id, password_hash, role`,
        [email, passwordHash],
      );
      if (!account) throw new Error('El correo administrativo pertenece a una cuenta de estudiante.');
    } else {
      [account] = await dbQuery<Account>(
        "SELECT id, password_hash, role FROM app_users WHERE email = $1 AND role = 'student'", [email],
      );
      const valid = await verifyPassword(password, account?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`);
      if (!account || !valid) return { success: false, error: 'Correo o contraseña incorrectos.' };
    }

    await createSession(account.id);
    await dbQuery('DELETE FROM auth_attempts WHERE email = $1', [email]);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error de autenticación:', error);
    return { success: false, error: 'No se pudo iniciar sesión. Comprueba la configuración del servidor y la conexión a Neon.' };
  }
}

export async function loginUser(email: string, password: string) {
  return authenticate(email, password, 'login');
}

export async function registerUser(email: string, password: string) {
  return authenticate(email, password, 'register');
}

export async function loginAdmin(email: string, password: string) {
  return authenticate(email, password, 'admin');
}

export async function logoutUser() {
  await deleteSession();
  revalidatePath('/');
}
