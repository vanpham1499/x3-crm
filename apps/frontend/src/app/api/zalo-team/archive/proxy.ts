import { zaloBackend } from '../service';

export async function archiveProxy(request: Request, suffix = '') {
  const origin = (process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin);
  if (request.method === 'POST' && request.headers.get('origin') !== origin)
    return Response.json({ message: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const cookie = request.headers.get('cookie') || '';
  const xsrf = cookie
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('XSRF-TOKEN='))
    ?.slice(11);
  const body = request.method === 'POST' ? await request.text() : undefined;
  if (body && body.length > 1048576)
    return Response.json({ message: 'Yêu cầu quá lớn.' }, { status: 413 });
  try {
    const kind = body ? JSON.parse(body).kind || '' : '';
    if (kind.startsWith('file-') && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))
      return Response.json({ message: 'Nhập file chỉ được mở qua localhost trên máy chứa file.' }, { status: 403 });
    const isLocalPc =
      !!process.env.ZALO_TEAM_PC_API_URL &&
      /^(pc-(status|connect|import|stop|prioritize|disconnect)|file-(status|pick|open|unlock|start|stop))$/.test(kind);
    const { url: api, headers: serviceHeaders } = isLocalPc
      ? { url: process.env.ZALO_TEAM_PC_API_URL!.replace(/\/$/, ''), headers: {} }
      : await zaloBackend();
    const r = await fetch(api + '/zalo-team/archive' + suffix, {
      method: request.method,
      cache: 'no-store',
      body,
      headers: {
        ...serviceHeaders,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: origin,
        Referer: origin + '/',
        ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
        ...(request.headers.get('range') ? { Range: request.headers.get('range')! } : {}),
      },
      redirect: 'error',
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(['verify', 'restore'].includes(kind) ? 900000 : 120000),
      ]),
    });
    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    for (const key of [
      'content-type',
      'content-disposition',
      'content-length',
      'content-range',
      'accept-ranges',
      'content-security-policy',
    ])
      if (r.headers.has(key)) headers.set(key, r.headers.get(key)!);
    return new Response(r.body, { status: r.status, headers });
  } catch {
    return Response.json(
      { message: 'Chưa kết nối được kho lưu trữ. Tải lại để kiểm tra.' },
      { status: 503 },
    );
  }
}
