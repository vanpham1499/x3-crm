import { authenticatedAccess, connectorAccess } from '../access';
import { requireAccount } from '@/features/zalo-team/account-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BYTES = 25 * 1024 * 1024;
export async function POST(request: Request) {
  try {
    const access = await authenticatedAccess(request);
    const owner = access.owner;
    if (request.headers.get('content-type') !== 'application/octet-stream')
      throw Error('INVALID_REQUEST');
    const header = request.headers.get('x-zalo-upload') || '';
    if (header.length > 4000) throw Error('INVALID_REQUEST');
    const meta = JSON.parse(decodeURIComponent(header));
    if (
      !meta ||
      Object.keys(meta).some(
        (k) => !['accountId', 'conversationId', 'name', 'mime', 'size', 'kind'].includes(k),
      ) ||
      !Number.isSafeInteger(meta.size) ||
      meta.size < 1 ||
      meta.size > MAX_BYTES ||
      !request.body
    )
      throw Error('WEB_UPLOAD_INVALID');
    requireAccount(access, meta.accountId, 'write');
    const { token, url } = await connectorAccess();
    let size = 0;
    const bounded = request.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          size += chunk.byteLength;
          if (size > meta.size || size > MAX_BYTES) throw Error('WEB_UPLOAD_TOO_LARGE');
          controller.enqueue(chunk);
        },
        flush() {
          if (size !== meta.size) throw Error('WEB_UPLOAD_INVALID');
        },
      }),
    );
    const response = await fetch(url + '/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'X-Zalo-Upload': encodeURIComponent(JSON.stringify({ ...meta, owner })),
      },
      body: bounded,
      duplex: 'half',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
    } as RequestInit & { duplex: 'half' });
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    const error =
      e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : 'WEB_UPLOAD_FAILED';
    return Response.json(
      { error },
      {
        status:
          error === 'CRM_LOGIN_REQUIRED'
            ? 401
            : ['INVALID_ORIGIN', 'WEB_ACCESS_DENIED'].includes(error)
              ? 403
              : 400,
      },
    );
  }
}
