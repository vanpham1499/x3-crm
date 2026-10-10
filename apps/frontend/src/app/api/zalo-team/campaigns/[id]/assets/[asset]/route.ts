import { zaloBackend } from '../../../../service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string; asset: string } }) {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(params.id) || !uuid.test(params.asset)) return new Response(null, { status: 404 });
  try {
    const { url, headers } = await zaloBackend();
    const origin = process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin;
    const response = await fetch(
      `${url.replace(/\/$/, '')}/zalo-team/campaigns/${params.id}/assets/${params.asset}`,
      {
        headers: {
          ...headers,
          Accept: 'application/json',
          Cookie: request.headers.get('cookie') || '',
          Origin: origin,
          Referer: origin + '/',
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
      },
    );
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
