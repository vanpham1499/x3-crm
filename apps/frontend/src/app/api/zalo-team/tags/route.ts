import { zaloBackend } from '../service';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (
    origin !== (process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin) ||
    !request.headers.get('content-type')?.startsWith('application/json')
  )
    return NextResponse.json({ message: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const body = await request.text();
  if (body.length > 300000)
    return NextResponse.json({ message: 'Yêu cầu quá lớn.' }, { status: 413 });
  let readOnly = false;
  try {
    readOnly = JSON.parse(body).kind === 'read';
  } catch {
    return NextResponse.json({ message: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  }
  try {
    const cookie = request.headers.get('cookie') || '';
    const xsrf = cookie
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('XSRF-TOKEN='))
      ?.slice('XSRF-TOKEN='.length);
    const { url: base, headers: serviceHeaders } = await zaloBackend();
    const response = await fetch(base.replace(/\/$/, '') + '/zalo-team/tags', {
      method: 'POST',
      headers: {
        ...serviceHeaders,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: cookie,
        ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
        Origin: origin,
        Referer: origin + '/',
      },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      {
        message: readOnly
          ? 'Chưa kết nối được dịch vụ phân loại. Vui lòng thử lại.'
          : 'Chưa xác nhận được kết quả. Tải lại để kiểm tra trước khi thao tác tiếp.',
      },
      { status: 503 },
    );
  }
}
