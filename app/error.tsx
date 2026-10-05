"use client";

import { useEffect } from 'react';
import styles from './admin/admin.module.css';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error('Error al cargar la plataforma:', error); }, [error]);
  return (
    <main className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>No se pudo cargar la plataforma</h1>
        <p role="alert">Revisa la conexión a Neon y la configuración del servidor. Tu progreso guardado no se ha modificado.</p>
        <button className={styles.loginBtn} onClick={reset}>Reintentar</button>
      </div>
    </main>
  );
}
