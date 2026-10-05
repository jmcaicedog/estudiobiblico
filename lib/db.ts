import { neon } from '@neondatabase/serverless';

let initialization: Promise<void> | undefined;

function connection() {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('placeholder_')) {
    throw new Error('Configura DATABASE_URL con una base de datos Neon para guardar cuentas y progreso.');
  }
  return neon(url);
}

async function initSchema() {
  const sql = connection();
  await sql.transaction([
    sql.query(`CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`),
    sql.query(`CREATE TABLE IF NOT EXISTS modules (
      id SERIAL PRIMARY KEY, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL, description TEXT, position INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`),
    sql.query(`CREATE TABLE IF NOT EXISTS lessons (
      id SERIAL PRIMARY KEY, module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL, description TEXT, video_url TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 0, position INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`),
    sql.query(`ALTER TABLE lessons
      ADD COLUMN IF NOT EXISTS resource_links JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS slides_name TEXT,
      ADD COLUMN IF NOT EXISTS slides_data BYTEA`),
    sql.query(`CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS app_single_admin
      ON app_users (role) WHERE role = 'admin'`),
    sql.query(`CREATE TABLE IF NOT EXISTS app_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )`),
    sql.query(`CREATE TABLE IF NOT EXISTS user_lesson_completions (
      user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, lesson_id)
    )`),
    sql.query(`CREATE TABLE IF NOT EXISTS auth_attempts (
      email TEXT PRIMARY KEY, attempts INTEGER NOT NULL,
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    sql.query(`INSERT INTO courses (title, description)
      SELECT 'Curso de Introducción al Estudio Bíblico',
        'Explora los fundamentos del estudio bíblico a tu propio ritmo.'
      WHERE NOT EXISTS (SELECT 1 FROM courses)`),
  ]);
}

export async function dbQuery<T = Record<string, unknown>>(
  queryText: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!initialization) {
    initialization = initSchema().catch((error: unknown) => {
      initialization = undefined;
      console.error('Error al inicializar Neon:', error);
      throw error;
    });
  }
  await initialization;
  const rows = await connection().query(queryText, params);
  return rows as T[];
}
