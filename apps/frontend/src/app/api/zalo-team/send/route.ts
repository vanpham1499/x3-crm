import { NextResponse } from 'next/server';
import { POST as webCommand } from '../web/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 20000) throw Error();
    body = JSON.parse(raw);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (k) =>
          ![
            'accountId',
            'conversationId',
            'requestId',
            'text',
            'styles',
            'mentions',
            'replyTo',
            'sticker',
            'media',
          ].includes(k),
      )
    )
      throw Error();
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }
  return webCommand(
    new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        ...body,
        action: body.media ? 'send-media' : body.sticker ? 'send-sticker' : 'send-text',
      }),
    }),
  );
}
