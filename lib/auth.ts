import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { dbQuery } from './db';
import { normalizeEmail, tokenHash, validEmail } from './auth-utils';

export const SESSION_COOKIE = 'estudiobiblico_session';

export interface SessionUser {
  id: number;
  email: string;
  role: 'student' | 'admin';
}

export function adminCredentials() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL || '');
  const password = process.env.ADMIN_PASSWORD || '';
  if (!validEmail(email) || password.length < 12 || password.length > 128) {
    throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD (de 12 a 128 caracteres).');
  }
  return { email, password };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [user] = await dbQuery<SessionUser>(
    `SELECT u.id, u.email, u.role FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
    [tokenHash(token)],
  );
  if (!user) return null;
  if (user.role === 'admin' && user.email !== normalizeEmail(process.env.ADMIN_EMAIL || '')) {
    return null;
  }
  return user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error('Inicia sesión para continuar.');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('Solo el administrador puede editar el contenido.');
  return user;
}

export async function createSession(userId: number) {
  const store = await cookies();
  const previous = store.get(SESSION_COOKIE)?.value;
  if (previous) await dbQuery('DELETE FROM app_sessions WHERE token_hash = $1', [tokenHash(previous)]);
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await dbQuery(
    'INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash(token), userId, expires.toISOString()],
  );
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', expires,
  });
  store.delete('estudiobiblico_admin_session');
}

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await dbQuery('DELETE FROM app_sessions WHERE token_hash = $1', [tokenHash(token)]);
  store.delete(SESSION_COOKIE);
  store.delete('estudiobiblico_admin_session');
}
