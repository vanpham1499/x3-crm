import { accessCommand } from '../access';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (request.headers.get('origin') !== (process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin))
    return Response.json({ message: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 100000) return Response.json({ message: 'Yêu cầu quá lớn.' }, { status: 413 });
    const response = await accessCommand(request, JSON.parse(raw));
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ message: 'Chưa kết nối được quản lý phân quyền.' }, { status: 503 });
  }
}
