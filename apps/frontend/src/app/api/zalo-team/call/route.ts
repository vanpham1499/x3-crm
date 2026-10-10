import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { authenticatedAccess, accessCommand } from '../access';
import { requireAccount } from '@/features/zalo-team/account-access';
import { ensureLocalGateway } from './gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') !== (process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin) ||
      !request.headers.get('content-type')?.startsWith('application/json')
    )
      return json({ error: 'INVALID_ORIGIN' }, 403);
    const access = await authenticatedAccess(request);
    const owner = access.owner;
    const raw = await request.text();
    if (raw.length > 70000) return json({ error: 'BODY_TOO_LARGE' }, 413);
    const body = JSON.parse(raw);
    if (!['capabilities', 'offer', 'start', 'status', 'end'].includes(body.action))
      return json({ error: 'INVALID_CALL_ACTION' }, 400);
    const url = new URL(process.env.ZALO_TEAM_CALL_URL || 'http://127.0.0.1:9260');
    // URL is server configuration; browsers cannot select the destination.
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw Error('CALL_UNAVAILABLE');
    if (body.action === 'capabilities') {
      const readHealth = () =>
        fetch(url.origin + '/health', {
          cache: 'no-store',
          signal: AbortSignal.timeout(1500),
          redirect: 'error',
        });
      // Recover only a missing worker. Never restart an occupied/unhealthy
      // service or replay offer/start/end after an uncertain response.
      let response: Response;
      try {
        response = await readHealth();
      } catch {
        await ensureLocalGateway(url);
        response = await readHealth();
      }
      const health = await response.json();
      return json({
        available: response.ok && health.callReady === true && health.provider === 'zrtc',
      });
    }
    if (
      !Number.isSafeInteger(body.accountId) ||
      body.accountId < 1 ||
      typeof body.conversationId !== 'string' ||
      !/^\d{1,30}$/.test(body.conversationId)
    )
      return json({ error: 'INVALID_CALL_SCOPE' }, 400);
    if (
      body.action === 'offer'
        ? body.offer?.type !== 'offer' ||
          typeof body.offer.sdp !== 'string' ||
          body.offer.sdp.length > 64000
        : !/^[a-f0-9-]{36}$/.test(body.sessionId || '')
    )
      return json({ error: 'INVALID_CALL_REQUEST' }, 400);
    requireAccount(access, body.accountId, 'write');
    const token = (
      await fs.readFile(
        process.env.ZALO_TEAM_CALL_TOKEN_FILE ||
          path.resolve(process.cwd(), '../../.local/zalo-call-assets/audio-token'),
        'utf8',
      )
    ).trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw Error('CALL_UNAVAILABLE');
    if (['offer', 'start', 'end'].includes(body.action)) {
      const logged = await accessCommand(request, {
        kind: 'audit',
        action: 'call.' + body.action,
        accountId: body.accountId,
      });
      if (!logged.ok) throw Error('WEB_ACCESS_DENIED');
    }
    const response = await fetch(url.origin + '/' + body.action, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner,
        actor: createHmac('sha256', token).update(String(access.userId)).digest('hex'),
        ...(body.action === 'offer' ? { crmSender: { userId: access.userId, name: access.userName || `Nhân viên #${access.userId}` } } : {}),
        accountId: body.accountId,
        conversationId: body.conversationId,
        ...(body.action === 'offer' ? { offer: body.offer } : { sessionId: body.sessionId }),
      }),
      signal: AbortSignal.timeout(15000),
    });
    return json(await response.json(), response.status);
  } catch (error) {
    const message =
      error instanceof Error && /^(CALL|WEB|CRM)_[A-Z_]+$/.test(error.message)
        ? error.message
        : 'CALL_UNAVAILABLE';
    return json(
      { error: message },
      message === 'WEB_ACCESS_DENIED' ? 403 : message === 'CRM_LOGIN_REQUIRED' ? 401 : 503,
    );
  }
}
