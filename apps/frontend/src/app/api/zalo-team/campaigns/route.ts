import { zaloBackend } from '../service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const type = request.headers.get('content-type') || '';
  if (
    origin !== (process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin) ||
    (!type.startsWith('application/json') && !type.startsWith('multipart/form-data;'))
  )
    return Response.json({ message: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  try {
    const cookie = request.headers.get('cookie') || '';
    const xsrf = cookie
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('XSRF-TOKEN='))
      ?.slice(11);
    const { url, headers } = await zaloBackend();
    let bytes = 0;
    const max = type.startsWith('application/json') ? 1000000 : 26 * 1024 * 1024;
    const body = request.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (bytes > max) throw Error('LIMIT');
          controller.enqueue(chunk);
        },
      }),
    );
    const response = await fetch(url.replace(/\/$/, '') + '/zalo-team/campaigns', {
      method: 'POST',
      headers: {
        ...headers,
        Accept: 'application/json',
        'Content-Type': type,
        ...(request.headers.get('content-length')
          ? { 'Content-Length': request.headers.get('content-length')! }
          : {}),
        Cookie: cookie,
        ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
        Origin: origin,
        Referer: origin + '/',
      },
      body,
      duplex: 'half',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
    } as RequestInit & { duplex: 'half' });
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      {
        message:
          'Chưa xác nhận được kết quả. Tải lại danh sách chiến dịch trước khi thao tác tiếp.',
      },
      { status: 503 },
    );
  }
}
