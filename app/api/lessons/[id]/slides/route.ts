import { getSessionUser } from '@/lib/auth';
import { dbQuery } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSessionUser()) {
    return Response.json({ error: 'Inicia sesión para descargar las diapositivas.' }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return Response.json({ error: 'Lección inválida.' }, { status: 400 });
  }
  const [slides] = await dbQuery<{ slides_name: string; data: string }>(
    `SELECT slides_name, encode(slides_data, 'base64') AS data
     FROM lessons WHERE id = $1 AND slides_data IS NOT NULL`, [Number(id)],
  );
  if (!slides) return Response.json({ error: 'Esta lección no tiene diapositivas.' }, { status: 404 });
  return new Response(new Uint8Array(Buffer.from(slides.data, 'base64')), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="diapositivas.pdf"; filename*=UTF-8''${encodeURIComponent(slides.slides_name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
