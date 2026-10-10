import { createHash } from 'node:crypto';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname))
    return new Response(null, {status:404});
  return Response.json({app:'x3sales-frontend',project:createHash('sha256').update(process.cwd().toLowerCase()).digest('hex')}, {
    headers:{'Cache-Control':'no-store'},
  });
}
