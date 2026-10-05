export interface ResourceLink {
  title: string;
  url: string;
}

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export class LessonInputError extends Error {}

export function validateLinks(value: unknown): ResourceLink[] {
  if (!Array.isArray(value)) throw new LessonInputError('Los enlaces deben ser una lista.');
  return value.map((link: unknown) => {
    if (!link || typeof link !== 'object' || !('title' in link) || !('url' in link)
      || typeof link.title !== 'string' || typeof link.url !== 'string') {
      throw new LessonInputError('Cada enlace debe tener un título y una URL.');
    }
    const title = link.title.trim();
    const url = link.url.trim();
    if (!title || title.length > 255) throw new LessonInputError('Cada enlace necesita un título de hasta 255 caracteres.');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new LessonInputError('Ingresa una URL válida para cada enlace.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new LessonInputError('Los enlaces solo pueden usar HTTP o HTTPS, sin credenciales.');
    }
    return { title, url };
  });
}

export function validatePdfSize(size: number) {
  if (size === 0 || size > MAX_PDF_BYTES) {
    throw new LessonInputError('El PDF debe pesar como máximo 10 MB y no puede estar vacío.');
  }
}

export function validatePdf(bytes: Uint8Array, name: string, type: string) {
  validatePdfSize(bytes.length);
  if (!name.toLowerCase().endsWith('.pdf') || type !== 'application/pdf'
    || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new LessonInputError('Selecciona un archivo PDF válido.');
  }
}
