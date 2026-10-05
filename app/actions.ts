"use server";

import { dbQuery } from '@/lib/db';
import { getSessionUser, requireAdmin, requireUser } from '@/lib/auth';
import { LessonInputError, ResourceLink, validateLinks, validatePdf, validatePdfSize } from '@/lib/lesson-resources';
import { revalidatePath } from 'next/cache';

export interface CourseStructure {
  course: { id: number; title: string; description: string };
  modules: Array<{
    id: number; title: string; description: string; position: number;
  }>;
  lessons: Array<{
    id: number; module_id: number; title: string; description: string;
    video_url: string; duration_seconds: number; position: number;
    resource_links: ResourceLink[]; slides_name: string | null;
  }>;
  completions: number[];
}

function refreshCourse() {
  revalidatePath('/');
  revalidatePath('/admin');
}

export async function checkAdminAuth() {
  return (await getSessionUser())?.role === 'admin';
}

export async function getCourseStructure(): Promise<CourseStructure | null> {
  const user = await requireUser();
  const [course] = await dbQuery<CourseStructure['course']>(
    "SELECT id, title, COALESCE(description, '') AS description FROM courses ORDER BY id LIMIT 1",
  );
  if (!course) return null;
  const modules = await dbQuery<CourseStructure['modules'][number]>(
    `SELECT id, title, COALESCE(description, '') AS description, position
     FROM modules WHERE course_id = $1 ORDER BY position, id`, [course.id],
  );
  const lessons = await dbQuery<CourseStructure['lessons'][number]>(
    `SELECT l.id, l.module_id, l.title, COALESCE(l.description, '') AS description,
       l.video_url, COALESCE(l.duration_seconds, 0) AS duration_seconds, l.position,
       l.resource_links, l.slides_name
     FROM lessons l JOIN modules m ON m.id = l.module_id
     WHERE m.course_id = $1 ORDER BY m.position, m.id, l.position, l.id`, [course.id],
  );
  const completions = await dbQuery<{ lesson_id: number }>(
    `SELECT c.lesson_id FROM user_lesson_completions c
     JOIN lessons l ON l.id = c.lesson_id JOIN modules m ON m.id = l.module_id
     WHERE c.user_id = $1 AND m.course_id = $2`, [user.id, course.id],
  );
  return { course, modules, lessons, completions: completions.map(c => c.lesson_id) };
}

export async function updateCourse(courseId: number, title: string, description: string) {
  await requireAdmin();
  await dbQuery(
    'UPDATE courses SET title = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    [title, description, courseId],
  );
  refreshCourse();
  return { success: true };
}

export async function createModule(courseId: number, title: string, description: string, position: number) {
  await requireAdmin();
  await dbQuery(
    'INSERT INTO modules (course_id, title, description, position) VALUES ($1, $2, $3, $4)',
    [courseId, title, description, position],
  );
  refreshCourse();
  return { success: true };
}

export async function updateModule(moduleId: number, title: string, description: string, position: number) {
  await requireAdmin();
  await dbQuery(
    'UPDATE modules SET title = $1, description = $2, position = $3 WHERE id = $4',
    [title, description, position, moduleId],
  );
  refreshCourse();
  return { success: true };
}

export async function deleteModule(moduleId: number) {
  await requireAdmin();
  await dbQuery('DELETE FROM modules WHERE id = $1', [moduleId]);
  refreshCourse();
  return { success: true };
}

export async function updateLesson(
  lessonId: number, title: string, description: string,
  videoUrl: string, durationSeconds: number, position: number,
) {
  await requireAdmin();
  await dbQuery(
    `UPDATE lessons SET title = $1, description = $2, video_url = $3,
     duration_seconds = $4, position = $5 WHERE id = $6`,
    [title, description, videoUrl, durationSeconds, position, lessonId],
  );
  refreshCourse();
  return { success: true };
}

export async function saveLesson(form: FormData) {
  await requireAdmin();
  try {
    const id = Number(form.get('id'));
    const moduleId = Number(form.get('moduleId'));
    const title = String(form.get('title') || '').trim();
    const description = String(form.get('description') || '');
    const videoUrl = String(form.get('videoUrl') || '').trim();
    const duration = Number(form.get('duration'));
    const position = Number(form.get('position'));
    if (!Number.isSafeInteger(id) || id < 0 || !Number.isSafeInteger(moduleId) || moduleId < 1
      || !title || title.length > 255 || !Number.isSafeInteger(duration) || duration < 0
      || !Number.isSafeInteger(position) || position < 1) {
      throw new LessonInputError('Revisa el título, módulo, duración y posición de la lección.');
    }
    if (videoUrl) validateLinks([{ title: 'Video', url: videoUrl }]);
    const links = validateLinks(JSON.parse(String(form.get('links') || '[]')));
    const file = form.get('slides');
    const removeSlides = form.get('removeSlides') === 'true';
    let slidesName: string | null = null;
    let slidesHex: string | null = null;
    const replacingSlides = file instanceof File && file.name !== '';
    if (replacingSlides) {
      validatePdfSize(file.size);
      const bytes = new Uint8Array(await file.arrayBuffer());
      validatePdf(bytes, file.name, file.type);
      slidesName = file.name.replace(/[\r\n]/g, '').slice(0, 255);
      slidesHex = Buffer.from(bytes).toString('hex');
    }
    const params = [title, description, videoUrl, duration, position, JSON.stringify(links), slidesName, slidesHex];
    if (id === 0) {
      await dbQuery(
        `INSERT INTO lessons (title, description, video_url, duration_seconds, position,
          resource_links, slides_name, slides_data, module_id)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, decode($8, 'hex'), $9)`,
        [...params, moduleId],
      );
    } else {
      const updated = await dbQuery<{ id: number }>(
        `UPDATE lessons SET title = $1, description = $2, video_url = $3,
         duration_seconds = $4, position = $5, resource_links = $6::jsonb,
         slides_name = CASE WHEN $10 THEN $7 ELSE slides_name END,
         slides_data = CASE WHEN $10 THEN decode($8, 'hex') ELSE slides_data END
         WHERE id = $9 AND module_id = $11 RETURNING id`,
        [...params, id, replacingSlides || removeSlides, moduleId],
      );
      if (!updated.length) throw new LessonInputError('La lección ya no existe en este módulo.');
    }
    refreshCourse();
    return { success: true };
  } catch (error) {
    console.error('Error al guardar la lección:', error);
    return { success: false, error: error instanceof LessonInputError
      ? error.message : 'No se pudo guardar la lección. Revisa los datos y la conexión al servidor.' };
  }
}

export async function deleteLesson(lessonId: number) {
  await requireAdmin();
  await dbQuery('DELETE FROM lessons WHERE id = $1', [lessonId]);
  refreshCourse();
  return { success: true };
}

export async function toggleLessonCompletion(lessonId: number, completed: boolean) {
  try {
    const user = await requireUser();
    if (!Number.isSafeInteger(lessonId) || lessonId < 1 || typeof completed !== 'boolean') {
      throw new Error('Lección o progreso inválido.');
    }
    if (completed) {
      await dbQuery(
        `INSERT INTO user_lesson_completions (user_id, lesson_id) VALUES ($1, $2)
         ON CONFLICT (user_id, lesson_id) DO NOTHING`, [user.id, lessonId],
      );
    } else {
      await dbQuery('DELETE FROM user_lesson_completions WHERE user_id = $1 AND lesson_id = $2', [user.id, lessonId]);
    }
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error al actualizar el progreso:', error);
    return { success: false, error: 'No se pudo guardar tu progreso. Revisa tu sesión y vuelve a intentar.' };
  }
}
