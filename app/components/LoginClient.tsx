"use client";

import { useState } from 'react';
import Link from 'next/link';
import { loginUser, registerUser } from '@/app/auth-actions';
import AppLogo from './AppLogo';
import styles from '../admin/admin.module.css';

export default function LoginClient() {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await (register ? registerUser : loginUser)(email, password);
      if (result.success) {
        window.location.assign('/');
      } else {
        setError(result.error);
      }
    } catch {
      setError('No se pudo conectar al servidor. Intenta nuevamente.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <AppLogo size={64} />
          </div>
          <h1 className={styles.loginTitle}>Estudio Bíblico</h1>
          <p className={styles.loginDesc}>Ingresa a tu cuenta para estudiar y guardar tu progreso.</p>
        </div>
        <div className={styles.authTabs}>
          <button type="button" aria-pressed={!register} disabled={pending} onClick={() => { setRegister(false); setError(''); }}>
            Iniciar sesión
          </button>
          <button type="button" aria-pressed={register} disabled={pending} onClick={() => { setRegister(true); setError(''); }}>
            Crear cuenta
          </button>
        </div>
        <form onSubmit={submit} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" autoComplete="email" maxLength={254} required
              value={email} onChange={e => setEmail(e.target.value)} disabled={pending} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" minLength={8} maxLength={128} required
              autoComplete={register ? 'new-password' : 'current-password'}
              value={password} onChange={e => setPassword(e.target.value)} disabled={pending} />
            {register && <small className={styles.loginDesc}>Usa al menos 8 caracteres.</small>}
          </div>
          {error && <p role="alert" className={styles.errorMsg}>{error}</p>}
          <button className={styles.loginBtn} disabled={pending}>
            {pending ? 'Procesando...' : register ? 'Registrarme y comenzar' : 'Ingresar al curso'}
          </button>
        </form>
        <Link href="/admin" className={styles.viewPortalBtn} style={{ justifyContent: 'center' }}>
          Acceso administrativo
        </Link>
      </div>
    </main>
  );
}
