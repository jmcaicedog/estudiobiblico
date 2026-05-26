import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL || '';

// Only initialize Neon if it's not the placeholder
const isRealDb = databaseUrl && !databaseUrl.includes('placeholder_user') && !databaseUrl.includes('placeholder_host');
const sql = isRealDb ? (neon(databaseUrl) as any) : null;

let isSchemaInitialized = false;

// --- IN-MEMORY MOCK DATABASE FALLBACK ---
interface MockCourse { id: number; title: string; description: string; }
interface MockModule { id: number; course_id: number; title: string; description: string; position: number; }
interface MockLesson { id: number; module_id: number; title: string; description: string; video_url: string; duration_seconds: number; position: number; }
interface MockCompletion { id: number; lesson_id: number; }

let mockCourses: MockCourse[] = [
  { id: 1, title: 'Curso de Estudio Bíblico (Modo Local)', description: 'Esta aplicación se está ejecutando con una base de datos en memoria local porque la variable de entorno DATABASE_URL no se ha configurado con tu credencial real de Neon. Los cambios realizados se perderán al reiniciar el servidor. Configura DATABASE_URL en tu archivo .env.local para conectar con Neon.' }
];

let mockModules: MockModule[] = [
  { id: 1, course_id: 1, title: 'Módulo 1: Fundamentos y Métodos', description: 'Comprendiendo las bases históricas y literarias de los textos bíblicos.', position: 1 },
  { id: 2, course_id: 1, title: 'Módulo 2: Interpretación Práctica', description: 'Cómo aplicar responsablemente los textos antiguos a la vida contemporánea.', position: 2 }
];

let mockLessons: MockLesson[] = [
  { id: 1, module_id: 1, title: '1.1 Bienvenida e Introducción', description: 'Bienvenido al curso. En esta lección inicial revisaremos los objetivos generales.', video_url: 'https://www.w3schools.com/html/mov_bbb.mp4', duration_seconds: 45, position: 1 },
  { id: 2, module_id: 1, title: '1.2 Entendiendo el Contexto Histórico', description: 'Aprenderemos por qué la geografía y la historia definen el sentido de los textos antiguos.', video_url: 'https://www.w3schools.com/html/movie.mp4', duration_seconds: 60, position: 2 },
  { id: 3, module_id: 2, title: '2.1 Principios de Hermenéutica', description: 'Explicación del arte y la ciencia de interpretar textos clásicos.', video_url: 'https://www.w3schools.com/html/mov_bbb.mp4', duration_seconds: 45, position: 1 }
];

let mockCompletions: MockCompletion[] = [];

let mockIdCounter = 100;

function mockDbQuery(queryText: string, params: any[] = []): any[] {
  const queryClean = queryText.replace(/\s+/g, ' ').trim().toLowerCase();

  // COURSES
  if (queryClean.startsWith('select') && queryClean.includes('from courses')) {
    if (queryClean.includes('where id =')) {
      const match = queryClean.match(/where id\s*=\s*\$?(\d+)/);
      const id = match ? parseInt(match[1]) : (params[0] || 1);
      return mockCourses.filter(c => c.id === id);
    }
    return mockCourses;
  }
  if (queryClean.startsWith('update courses')) {
    // UPDATE courses SET title = $1, description = $2 WHERE id = $3
    const title = params[0];
    const desc = params[1];
    const id = params[2];
    mockCourses = mockCourses.map(c => c.id === id ? { ...c, title, description: desc } : c);
    return mockCourses.filter(c => c.id === id);
  }

  // MODULES
  if (queryClean.startsWith('select') && queryClean.includes('from modules')) {
    // SELECT * FROM modules WHERE course_id = $1 ORDER BY position ASC
    const courseId = params[0] || 1;
    return mockModules
      .filter(m => m.course_id === courseId)
      .sort((a, b) => a.position - b.position);
  }
  if (queryClean.startsWith('insert into modules')) {
    // INSERT INTO modules (course_id, title, description, position) VALUES ($1, $2, $3, $4) RETURNING *
    const id = mockIdCounter++;
    const course_id = params[0];
    const title = params[1];
    const description = params[2];
    const position = params[3];
    const newModule = { id, course_id, title, description, position };
    mockModules.push(newModule);
    return [newModule];
  }
  if (queryClean.startsWith('update modules')) {
    // UPDATE modules SET title = $1, description = $2, position = $3 WHERE id = $4
    const title = params[0];
    const description = params[1];
    const position = params[2];
    const id = params[3];
    mockModules = mockModules.map(m => m.id === id ? { ...m, title, description, position } : m);
    return mockModules.filter(m => m.id === id);
  }
  if (queryClean.startsWith('delete from modules')) {
    // DELETE FROM modules WHERE id = $1
    const id = params[0];
    mockModules = mockModules.filter(m => m.id !== id);
    mockLessons = mockLessons.filter(l => l.module_id !== id);
    return [];
  }

  // LESSONS
  if (queryClean.startsWith('select') && queryClean.includes('from lessons')) {
    // SELECT * FROM lessons
    if (queryClean.includes('where module_id =')) {
      const moduleId = params[0];
      return mockLessons
        .filter(l => l.module_id === moduleId)
        .sort((a, b) => a.position - b.position);
    }
    return mockLessons.sort((a, b) => a.position - b.position);
  }
  if (queryClean.startsWith('insert into lessons')) {
    // INSERT INTO lessons (module_id, title, description, video_url, duration_seconds, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    const id = mockIdCounter++;
    const module_id = params[0];
    const title = params[1];
    const description = params[2];
    const video_url = params[3];
    const duration_seconds = params[4];
    const position = params[5];
    const newLesson = { id, module_id, title, description, video_url, duration_seconds, position };
    mockLessons.push(newLesson);
    return [newLesson];
  }
  if (queryClean.startsWith('update lessons')) {
    // UPDATE lessons SET title = $1, description = $2, video_url = $3, duration_seconds = $4, position = $5 WHERE id = $6
    const title = params[0];
    const description = params[1];
    const video_url = params[2];
    const duration_seconds = params[3];
    const position = params[4];
    const id = params[5];
    mockLessons = mockLessons.map(l => l.id === id ? { ...l, title, description, video_url, duration_seconds, position } : l);
    return mockLessons.filter(l => l.id === id);
  }
  if (queryClean.startsWith('delete from lessons')) {
    // DELETE FROM lessons WHERE id = $1
    const id = params[0];
    mockLessons = mockLessons.filter(l => l.id !== id);
    mockCompletions = mockCompletions.filter(c => c.lesson_id !== id);
    return [];
  }

  // COMPLETIONS
  if (queryClean.startsWith('select') && queryClean.includes('from lesson_completions')) {
    return mockCompletions;
  }
  if (queryClean.startsWith('insert into lesson_completions')) {
    const lesson_id = params[0];
    if (!mockCompletions.some(c => c.lesson_id === lesson_id)) {
      mockCompletions.push({ id: mockIdCounter++, lesson_id });
    }
    return [{ lesson_id }];
  }
  if (queryClean.startsWith('delete from lesson_completions')) {
    const lesson_id = params[0];
    mockCompletions = mockCompletions.filter(c => c.lesson_id !== lesson_id);
    return [];
  }

  return [];
}

// --- SCHEMA INITIALIZATION ---
async function initSchema() {
  if (!isRealDb || !sql) {
    console.log('🛠️ Iniciando en Modo Local (Base de datos en memoria)');
    isSchemaInitialized = true;
    return;
  }

  console.log('🛠️ Conectado a Neon. Verificando esquema de tablas...');
  try {
    // Create tables in sequence using sql.query
    await sql.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await sql.query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await sql.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        video_url VARCHAR(1024) NOT NULL,
        duration_seconds INTEGER DEFAULT 0,
        position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await sql.query(`
      CREATE TABLE IF NOT EXISTS lesson_completions (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if courses is empty
    const courses = await sql.query('SELECT id FROM courses LIMIT 1');
    if (courses.length === 0) {
      console.log('🌱 Sembrando datos iniciales en Neon...');
      
      const newCourse = await sql.query(`
        INSERT INTO courses (title, description)
        VALUES ('Curso de Introducción al Estudio Bíblico', 'Un curso completo guiado por videos para explorar los fundamentos del estudio bíblico, su historia, géneros literarios e interpretación práctica.')
        RETURNING id
      `);
      
      const courseId = newCourse[0].id;

      const m1 = await sql.query(`
        INSERT INTO modules (course_id, title, description, position)
        VALUES ($1, 'Módulo 1: Fundamentos y Métodos', 'Comprendiendo las bases históricas y literarias de los textos bíblicos.', 1)
        RETURNING id
      `, [courseId]);

      const m2 = await sql.query(`
        INSERT INTO modules (course_id, title, description, position)
        VALUES ($1, 'Módulo 2: Interpretación Práctica', 'Cómo aplicar responsablemente los textos antiguos a la vida y cultura contemporánea.', 2)
        RETURNING id
      `, [courseId]);

      const m1Id = m1[0].id;
      const m2Id = m2[0].id;

      await sql.query(`
        INSERT INTO lessons (module_id, title, description, video_url, duration_seconds, position)
        VALUES 
          ($1, '1.1 Bienvenida e Introducción', 'En esta primera lección aprenderás los objetivos generales del curso y cómo navegar por los módulos.', 'https://www.w3schools.com/html/mov_bbb.mp4', 45, 1),
          ($1, '1.2 Entendiendo el Contexto Histórico', 'Aprenderemos por qué la geografía, cultura y época de los autores originales definen el sentido del texto.', 'https://www.w3schools.com/html/movie.mp4', 60, 2)
      `, [m1Id]);

      await sql.query(`
        INSERT INTO lessons (module_id, title, description, video_url, duration_seconds, position)
        VALUES 
          ($1, '2.1 Principios de Hermenéutica', 'Explicación del arte y la ciencia de interpretar textos antiguos de manera balanceada y fiel.', 'https://www.w3schools.com/html/mov_bbb.mp4', 45, 1)
      `, [m2Id]);
      
      console.log('✅ Siembra completada en Neon.');
    } else {
      console.log('✅ Esquema existente verificado.');
    }
    
    isSchemaInitialized = true;
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos Neon:', error);
  }
}

// Wrapper for executing query
export async function dbQuery<T = any>(queryText: string, params: any[] = []): Promise<T[]> {
  if (!isSchemaInitialized) {
    await initSchema();
  }

  if (!isRealDb || !sql) {
    return mockDbQuery(queryText, params) as T[];
  }

  try {
    return (await sql.query(queryText, params)) as T[];
  } catch (error) {
    console.error(`Error de base de datos ejecutando consulta: ${queryText}`, error);
    throw error;
  }
}
