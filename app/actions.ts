"use server";

import { cookies } from 'next/headers';
import { dbQuery } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// --- AUTHENTICATION ---
const SESSION_COOKIE_NAME = 'estudiobiblico_admin_session';

export async function loginAdmin(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (password === adminPassword) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/'
    });
    return { success: true };
  }
  
  return { success: false, error: 'Contraseña incorrecta' };
}

export async function checkAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  return session?.value === 'authenticated';
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  revalidatePath('/');
}

// --- DATABASE FETCH ---
export interface CourseStructure {
  course: {
    id: number;
    title: string;
    description: string;
  };
  modules: Array<{
    id: number;
    title: string;
    description: string;
    position: number;
  }>;
  lessons: Array<{
    id: number;
    module_id: number;
    title: string;
    description: string;
    video_url: string;
    duration_seconds: number;
    position: number;
  }>;
  completions: number[]; // Array of lesson_ids
}

export async function getCourseStructure(): Promise<CourseStructure | null> {
  try {
    const courses = await dbQuery('SELECT id, title, description FROM courses ORDER BY id ASC');
    if (courses.length === 0) {
      return null;
    }
    const course = courses[0];
    
    const modules = await dbQuery('SELECT id, title, description, position FROM modules WHERE course_id = $1 ORDER BY position ASC', [course.id]);
    const lessons = await dbQuery('SELECT id, module_id, title, description, video_url, duration_seconds, position FROM lessons ORDER BY position ASC');
    const completionsData = await dbQuery('SELECT lesson_id FROM lesson_completions');
    
    return {
      course: {
        id: course.id,
        title: course.title,
        description: course.description
      },
      modules: modules.map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description || '',
        position: m.position
      })),
      lessons: lessons.map((l: any) => ({
        id: l.id,
        module_id: l.module_id,
        title: l.title,
        description: l.description || '',
        video_url: l.video_url,
        duration_seconds: l.duration_seconds || 0,
        position: l.position
      })),
      completions: completionsData.map((c: any) => c.lesson_id)
    };
  } catch (error) {
    console.error('Error fetching course structure:', error);
    return null;
  }
}

// --- COURSE OPERATIONS ---
export async function updateCourse(courseId: number, title: string, description: string) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) throw new Error('No autorizado');

  await dbQuery(
    'UPDATE courses SET title = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    [title, description, courseId]
  );
  revalidatePath('/');
  return { success: true };
}

// --- MODULE OPERATIONS ---
export async function createModule(courseId: number, title: string, description: string, position: number) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) throw new Error('No autorizado');

  await dbQuery(
    'INSERT INTO modules (course_id, title, description, position) VALUES ($1, $2, $3, $4)',
    [courseId, title, description, position]
  );
  revalidatePath('/');
  return { success: true };
}

export async function updateModule(moduleId: number, title: string, description: string, position: number) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) throw new Error('No autorizado');

  await dbQuery(
    'UPDATE modules SET title = $1, description = $2, position = $3 WHERE id = $4',
    [title, description, position, moduleId]
  );
  revalidatePath('/');
  return { success: true };
}

export async function deleteModule(moduleId: number) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) throw new Error('No autorizado');

  await dbQuery('DELETE FROM modules WHERE id = $1', [moduleId]);
  revalidatePath('/');
  return { success: true };
}

// --- LESSON OPERATIONS ---
export async function createLesson(
  moduleId: number,
  title: string,
  description: string,
  videoUrl: string,
  durationSeconds: number,
  position: number
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) throw new Error('No autorizado');

  await dbQuery(
    'INSERT INTO lessons (module_id, title, description, video_url, duration_seconds, position) VALUES ($1, $2, $3, $4, $5, $6)',
    [moduleId, title, description, videoUrl, durationSeconds, position]
  );
  revalidatePath('/');
  return { success: true };
}

export async function updateLesson(
  lessonId: number,
  title: string,
  description: string,
  videoUrl: string,
  durationSeconds: number,
  position: number
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) throw new Error('No autorizado');

  await dbQuery(
    'UPDATE lessons SET title = $1, description = $2, video_url = $3, duration_seconds = $4, position = $5 WHERE id = $6',
    [title, description, videoUrl, durationSeconds, position, lessonId]
  );
  revalidatePath('/');
  return { success: true };
}

export async function deleteLesson(lessonId: number) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) throw new Error('No autorizado');

  await dbQuery('DELETE FROM lessons WHERE id = $1', [lessonId]);
  revalidatePath('/');
  return { success: true };
}

// --- COMPLETIONS ---
export async function toggleLessonCompletion(lessonId: number, completed: boolean) {
  try {
    if (completed) {
      // Check if already completed to avoid duplicate inserts
      const existing = await dbQuery('SELECT 1 FROM lesson_completions WHERE lesson_id = $1', [lessonId]);
      if (existing.length === 0) {
        await dbQuery('INSERT INTO lesson_completions (lesson_id) VALUES ($1)', [lessonId]);
      }
    } else {
      await dbQuery('DELETE FROM lesson_completions WHERE lesson_id = $1', [lessonId]);
    }
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error toggling completion:', error);
    return { success: false, error: 'Error al actualizar el progreso' };
  }
}
