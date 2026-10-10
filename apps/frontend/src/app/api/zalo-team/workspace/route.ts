import { accessCommand } from '../access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const origin = process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin;
  if (request.headers.get('origin') !== origin)
    return Response.json({ message: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 12000) return Response.json({ message: 'Yêu cầu quá lớn.' }, { status: 413 });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json({ message: 'Yêu cầu không hợp lệ.' }, { status: 400 });
    }
    const response = await accessCommand(request, body, 'workspace');
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return Response.json(
      { message: 'Chưa kết nối được hồ sơ CRM. Vui lòng tải lại.' },
      { status: 503 },
    );
  }
}
