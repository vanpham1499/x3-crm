import { POST as webCommand } from '../web/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reuse the same CRM authentication, owner scope and private worker proxy.
export async function POST(request: Request) {
  return webCommand(
    new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      signal: request.signal,
      body: JSON.stringify({ action: 'conversations' }),
    }),
  );
}
