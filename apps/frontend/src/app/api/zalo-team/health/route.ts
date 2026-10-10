export const dynamic = 'force-dynamic';

// Process health only. Never expose account, dependency or configuration details.
export function GET() {
  return Response.json({ status: 'ok', service: 'zalo-team-frontend' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
