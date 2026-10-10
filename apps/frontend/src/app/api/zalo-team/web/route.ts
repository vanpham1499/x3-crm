import { validMessageSearch } from '@/features/zalo-team/message-search';
import { validDirectory, directoryReads } from '@/features/zalo-team/directory';
import { validFriend } from '@/features/zalo-team/friend-actions';
import { validGroupLink } from '@/features/zalo-team/group-links';
import { validTopic } from '@/features/zalo-team/topics';
import { validPoll } from '@/features/zalo-team/polls';
import { validGroup } from '@/features/zalo-team/group-actions';
import { validConversationSettings } from '@/features/zalo-team/conversation-settings';
import { validMentions } from '@/features/zalo-team/mentions';
import { validRichStyles } from '@/features/zalo-team/rich-text';
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { authenticatedAccess, accessCommand } from '../access';
import { authorizeWeb, filterWeb, type AccountAccess } from '@/features/zalo-team/account-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const traceId = crypto.randomUUID(), startedAt = Date.now();
  const logFailure = (stage: string, code: string) => console.warn(JSON.stringify({
    event: 'zalo-web-request', requestId: traceId, stage, code, ms: Date.now() - startedAt,
  }));
  const origin = request.headers.get('origin');
  if (
    origin !== (process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin) ||
    !request.headers.get('content-type')?.startsWith('application/json')
  )
    return json({ error: 'INVALID_ORIGIN' }, 403);
  let access: AccountAccess;
  let owner: string;
  try {
    access = await authenticatedAccess(request);
    owner = access.owner;
  } catch (e) {
    const error =
      e instanceof Error && e.message === 'CRM_LOGIN_REQUIRED'
        ? 'CRM_LOGIN_REQUIRED'
        : 'CRM_UNAVAILABLE';
    logFailure('crm-auth', error);
    return json({ error, requestId: traceId }, error === 'CRM_LOGIN_REQUIRED' ? 401 : 503);
  }
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 20000) throw Error();
    body = JSON.parse(raw);
    if (
      !body ||
      ![
        'status',
        'group-links',
        'begin',
        'retry',
        'cancel',
        'stop',
        'friend-action',
        'directory',
        'conversations',
        'messages',
        'message-search',
        'conversation-info',
        'conversation-settings',
        'group-action',
        'poll-action',
        'topic-action',
        'message-action',
        'send-text',
        'send-sticker',
        'send-media',
        'expressions',
        'mentions',
        'events',
      ].includes(body.action) ||
      Object.keys(body).some(
        (k) =>
          ![
            'action',
            'link',
            'loginId',
            'departmentId',
            'accountId',
            'conversationId',
            'before',
            'section',
            'cursor',
            'text',
            'styles',
            'mentions',
            'requestId',
            'refresh',
            'sticker',
            'media',
            'categoryId',
            'query',
            'search',
            'settings',
            'group',
            'friend',
            'directory',
            'poll',
            'topic',
            'replyTo',
            'messageId',
            'operation',
            'reaction',
          ].includes(k),
      ) ||
      (body.action === 'message-search'
        ? !validMessageSearch(body.search) ||
          Object.keys(body).some(
            (k) => !['action', 'accountId', 'conversationId', 'search'].includes(k),
          )
        : body.search !== undefined) ||
      (body.action === 'group-links'
        ? !validGroupLink(body.link) ||
          Object.keys(body).some((k) => !['action', 'link'].includes(k))
        : body.link !== undefined) ||
      (body.action === 'topic-action' ? !validTopic(body.topic) : body.topic !== undefined) ||
      (body.action === 'poll-action'
        ? !validPoll(body.poll) || !/^g\d+$/.test(body.conversationId)
        : body.poll !== undefined) ||
      (body.action === 'directory'
        ? !validDirectory(body.directory) ||
          body.accountId === undefined ||
          Object.keys(body).some(
            (k) => !['action', 'accountId', 'directory', 'requestId'].includes(k),
          )
        : body.directory !== undefined) ||
      (body.action === 'friend-action'
        ? !validFriend(body.friend) || body.conversationId !== undefined
        : body.friend !== undefined) ||
      (body.action === 'group-action' ? !validGroup(body.group) : body.group !== undefined) ||
      (body.action === 'conversation-settings'
        ? !validConversationSettings(body.settings)
        : body.settings !== undefined) ||
      (body.replyTo !== undefined &&
        (!['send-text', 'send-sticker', 'send-media'].includes(body.action) ||
          typeof body.replyTo !== 'string' ||
          !/^\d{1,30}$/.test(body.replyTo))) ||
      (body.action === 'message-action'
        ? typeof body.messageId !== 'string' ||
          !/^\d{1,30}$/.test(body.messageId) ||
          !['star', 'unstar', 'pin', 'recall', 'delete', 'react'].includes(body.operation) ||
          (body.operation === 'react'
            ? ![3, 5, 0, 32, 2, 20, -1].includes(body.reaction)
            : body.reaction !== undefined)
        : body.messageId !== undefined ||
          body.operation !== undefined ||
          body.reaction !== undefined) ||
      (body.mentions !== undefined &&
        (body.action !== 'send-text' ||
          !/^g\d+$/.test(body.conversationId) ||
          !validMentions(body.mentions, body.text))) ||
      (body.styles !== undefined &&
        (body.action !== 'send-text' || !validRichStyles(body.styles, body.text))) ||
      (body.sticker === undefined
        ? body.action === 'send-sticker'
        : body.action !== 'send-sticker' ||
          !body.sticker ||
          typeof body.sticker !== 'object' ||
          Array.isArray(body.sticker) ||
          Object.keys(body.sticker).length !== 2 ||
          !Number.isSafeInteger(body.sticker.id) ||
          body.sticker.id <= 0 ||
          body.sticker.id > 2147483647 ||
          !Number.isSafeInteger(body.sticker.categoryId) ||
          body.sticker.categoryId < -10 ||
          body.sticker.categoryId > 2147483647) ||
      (body.media === undefined
        ? body.action === 'send-media'
        : body.action !== 'send-media' ||
          !body.media ||
          typeof body.media !== 'object' ||
          Array.isArray(body.media) ||
          Object.keys(body.media).length !== 1 ||
          !/^[a-f0-9-]{36}$/.test(body.media.uploadId || '')) ||
      (body.categoryId !== undefined &&
        (body.action !== 'expressions' ||
          !Number.isSafeInteger(body.categoryId) ||
          body.categoryId < -10 ||
          body.categoryId > 2147483647)) ||
      (body.query !== undefined &&
        (body.action !== 'expressions' ||
          typeof body.query !== 'string' ||
          body.query.length > 100)) ||
      (body.refresh !== undefined &&
        (body.action !== 'messages' || typeof body.refresh !== 'boolean' || body.before)) ||
      (body.accountId !== undefined &&
        (!Number.isSafeInteger(body.accountId) || body.accountId < 1)) ||
      ([
        'stop',
        'friend-action',
        'messages',
        'message-search',
        'conversation-info',
        'conversation-settings',
        'group-action',
        'poll-action',
        'topic-action',
        'message-action',
        'send-text',
        'send-sticker',
        'send-media',
        'expressions',
        'mentions',
      ].includes(body.action) &&
        body.accountId === undefined) ||
      ([
        'messages',
        'message-search',
        'conversation-info',
        'conversation-settings',
        'group-action',
        'poll-action',
        'topic-action',
        'message-action',
        'send-text',
        'send-sticker',
        'send-media',
        'expressions',
        'mentions',
      ].includes(body.action) &&
        !(
          body.action === 'group-action' &&
          ['catalog', 'create'].includes(body.group.kind) &&
          body.conversationId === undefined
        ) &&
        (typeof body.conversationId !== 'string' || !/^g?\d{1,30}$/.test(body.conversationId))) ||
      (body.action === 'send-text'
        ? typeof body.text !== 'string' ||
          !body.text.trim() ||
          body.text.length > 2000 ||
          typeof body.requestId !== 'string' ||
          !/^[a-f0-9-]{36}$/.test(body.requestId)
        : ['send-sticker', 'send-media', 'message-action'].includes(body.action) ||
            (body.action === 'friend-action' && body.friend.kind === 'send') ||
            (body.action === 'directory' && !directoryReads.includes(body.directory.kind)) ||
            (body.action === 'group-action' && body.group.kind !== 'catalog') ||
            (body.action === 'topic-action' && body.topic.kind !== 'catalog') ||
            (body.action === 'poll-action' && body.poll.kind !== 'catalog')
          ? body.text !== undefined ||
            typeof body.requestId !== 'string' ||
            !/^[a-f0-9-]{36}$/.test(body.requestId)
          : body.text !== undefined || body.requestId !== undefined) ||
      (body.section !== undefined &&
        (body.action !== 'conversation-info' ||
          !['overview', 'images', 'files', 'links', 'members'].includes(body.section))) ||
      (body.cursor !== undefined &&
        (body.action !== 'conversation-info' ||
          !body.section ||
          body.section === 'overview' ||
          typeof body.cursor !== 'string' ||
          !/^\d{1,30}$/.test(body.cursor))) ||
      (body.before !== undefined &&
        (body.action !== 'messages' ||
          !body.before ||
          typeof body.before !== 'object' ||
          Object.keys(body.before).length !== 2 ||
          typeof body.before.id !== 'string' ||
          !/^[\w-]{1,80}$/.test(body.before.id) ||
          typeof body.before.time !== 'string' ||
          !/^\d{1,16}$/.test(body.before.time))) ||
      (body.loginId !== undefined &&
        (typeof body.loginId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.loginId)))
    )
      throw Error();
  } catch {
    return json({ error: 'INVALID_REQUEST' }, 400);
  }
  try {
    authorizeWeb(access, body);
    if (['begin', 'retry', 'cancel'].includes(body.action)) {
      const result = await accessCommand(request, { kind: 'login', ...body });
      if (!result.ok) return json(await result.json(), result.status);
      access = await authenticatedAccess(request);
      body = { action: 'status' };
    }
  } catch {
    return json({ error: 'WEB_ACCESS_DENIED' }, 403);
  }
  let token;
  try {
    token = (
      await fs.readFile(
        process.env.ZALO_TEAM_WEB_TOKEN_FILE ||
          path.resolve(process.cwd(), '../../tooling/zalo-team/.local/web-token'),
        'utf8',
      )
    ).trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw Error();
  } catch {
    return json({ error: 'WEB_NOT_PREPARED' }, 503);
  }
  try {
    const readOnly =
      [
        'status',
        'events',
        'conversations',
        'messages',
        'message-search',
        'conversation-info',
        'expressions',
        'mentions',
      ].includes(body.action) ||
      (body.action === 'directory' && directoryReads.includes(body.directory.kind)) ||
      (body.action === 'friend-action' &&
        ['search', 'status', 'open'].includes(body.friend.kind)) ||
      (body.action === 'conversation-settings' &&
        ['read', 'privacy', 'hidden-list'].includes(body.settings.kind)) ||
      (['group-action', 'poll-action', 'topic-action'].includes(body.action) &&
        (body.group?.kind || body.poll?.kind || body.topic?.kind) === 'catalog');
    if (!readOnly) {
      const logged = await accessCommand(request, {
        kind: 'audit',
        action: body.action,
        accountId: body.accountId,
        requestId: body.requestId,
      });
      if (!logged.ok) return json({ error: 'WEB_ACCESS_DENIED' }, 403);
    }
    const response = await fetch(
      `${(process.env.ZALO_TEAM_WEB_URL || 'http://127.0.0.1:9250').replace(/\/$/, '')}/command`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept:
            request.headers.get('accept') === 'application/x-ndjson'
              ? 'application/x-ndjson'
              : 'application/json',
        },
        body: JSON.stringify({
          ...body,
          owner,
          ...(['send-text', 'send-sticker', 'send-media'].includes(body.action)
            ? { crmSender: { userId: access.userId, name: access.userName || `Nhân viên #${access.userId}` } }
            : {}),
        }),
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(body.action === 'send-media' ? 180000 : body.action === 'conversations' ? 12000 : 55000),
        ]),
      },
    );
    if (response.ok && response.headers.get('content-type')?.includes('application/x-ndjson')) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder(),
        encoder = new TextEncoder();
      let pending = '';
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { value, done } = await reader.read();
              pending += decoder.decode(value, { stream: !done });
              // One fresh authorization for this received chunk, shared by its
              // packets. Never retain rights across subsequent stream reads.
              const current = pending.includes('\n') ? await authenticatedAccess(request) : access;
              authorizeWeb(current, body);
              let end;
              while ((end = pending.indexOf('\n')) >= 0) {
                const line = pending.slice(0, end);
                pending = pending.slice(end + 1);
                if (!line.trim()) continue;
                const packet = JSON.parse(line);
                if (
                  packet.accountId !== undefined &&
                  !current.admin &&
                  !current.accounts[String(packet.accountId)]?.read
                )
                  continue;
                controller.enqueue(
                  encoder.encode(JSON.stringify(filterWeb(current, packet)) + '\n'),
                );
              }
              if (done) break;
            }
            controller.close();
          } catch {
            logFailure('stream', request.signal.aborted ? 'REQUEST_CANCELLED' : 'WEB_STREAM_INTERRUPTED');
            try {
              controller.enqueue(encoder.encode(JSON.stringify({error:'WEB_STREAM_INTERRUPTED', requestId:traceId}) + '\n'));
              controller.close();
            } catch {}
          } finally {
            await reader.cancel().catch(() => {});
          }
        },
        cancel() {
          return reader.cancel();
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-store',
          'X-Accel-Buffering': 'no',
        },
      });
    }
    let data = await response.json();
    if (data.login?.state === 'connected' && access.loginIds.includes(data.login.id)) {
      const finished = await accessCommand(request, {
        kind: 'finish-login',
        loginId: data.login.id,
      });
      if (finished.ok) access = await authenticatedAccess(request);
    }
    data = filterWeb(access, data);
    return json(data, response.ok ? 200 : 409);
  } catch {
    logFailure('connector', request.signal.aborted ? 'REQUEST_CANCELLED' : 'WEB_UNAVAILABLE');
    return json({ error: 'WEB_UNAVAILABLE', requestId: traceId }, 503);
  }
}
