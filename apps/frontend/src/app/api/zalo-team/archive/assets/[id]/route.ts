import { archiveProxy } from '../../proxy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(id)) return new Response(null, { status: 404 });
  return archiveProxy(request, '/assets/' + id);
}
