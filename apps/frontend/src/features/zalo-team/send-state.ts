'use client';
import { useRef, useSyncExternalStore } from 'react';
import { noMentions, type Mention } from './mentions';
import type { RichStyle } from './rich-text';
import { packets } from './live';
import type { StickerChoice } from './types';
import type { PickedAttachment } from './types';
import type { ChatMessage, ReplyTarget } from './types';

type Receipt = {
  crmSender?: ChatMessage['crmSender'];
  status: 'prepared' | 'sent' | 'failed' | 'unknown';
  clientId?: string;
  messageId?: string;
  time?: number;
};
export type Outgoing = {
  requestId: string;
  text: string;
  styles?: RichStyle[];
  mentions?: Mention[];
  reply?: ReplyTarget;
  sticker?: StickerChoice;
  media?: { file: File; kind: 'image' | 'file'; preview?: string; uploadId?: string };
  time: number;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'unknown';
  receipt?: Receipt;
};
type Draft = {
  text: string;
  pastedImages: File[];
  styles?: RichStyle[];
  mentions?: Mention[];
  reply?: ReplyTarget;
  busy: boolean;
  checking: boolean;
  status: string;
  error: string;
  outgoing: Outgoing[];
};
const empty: Draft = {
  text: '',
  pastedImages: [],
  busy: false,
  checking: false,
  status: '',
  error: '',
  outgoing: [],
};
const drafts = new Map<string, Draft>();
const listeners = new Set<() => void>();
const running = new Set<string>();
const get = (key: string) => drafts.get(key) || empty;
function update(key: string, patch: Partial<Draft>) {
  drafts.set(key, { ...get(key), ...patch });
  listeners.forEach((fn) => fn());
}
function replace(key: string, id: string, patch: Partial<Outgoing>) {
  update(key, {
    outgoing: get(key).outgoing.map((item) =>
      item.requestId === id ? { ...item, ...patch } : item,
    ),
  });
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function requestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const preflight = new Set([
  'CRM_LOGIN_REQUIRED',
  'INVALID_REQUEST',
  'WEB_ACCOUNT_OFFLINE',
  'WEB_IDENTITY_MISMATCH',
  'WEB_CONVERSATION_NOT_FOUND',
  'WEB_SEND_ADAPTER_CHANGED',
  'WEB_SEND_TEXT_TOO_LONG',
  'WEB_REPLY_UNAVAILABLE',
  'WEB_MENTION_UNAVAILABLE',
  'WEB_MENTION_TIMEOUT',
  'WEB_MENTION_ADAPTER_CHANGED',
  'WEB_SEND_REQUEST_CONFLICT',
  'WEB_STICKER_ADAPTER_CHANGED',
  'WEB_STICKER_UNAVAILABLE',
  'WEB_STICKER_TIMEOUT',
  'WEB_UPLOAD_EXPIRED',
  'WEB_UPLOAD_INVALID',
  'WEB_UPLOAD_TOO_LARGE',
  'WEB_UPLOAD_SCOPE_MISMATCH',
  'WEB_MEDIA_ADAPTER_CHANGED',
]);
async function submit(
  key: string,
  accountId: number,
  conversationId: string,
  item: Outgoing,
  check: boolean,
) {
  replace(key, item.requestId, { status: 'sending' });
  update(key, { busy: true, checking: check, status: 'sending', error: '' });
  let final = false;
  let submitting = false;
  try {
    let media = item.media;
    if (media && !media.uploadId) {
      const upload = await fetch('/api/zalo-team/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Zalo-Upload': encodeURIComponent(
            JSON.stringify({
              accountId,
              conversationId,
              name: media.file.name,
              mime: media.file.type || 'application/octet-stream',
              size: media.file.size,
              kind: media.kind,
            }),
          ),
        },
        body: media.file,
        signal: AbortSignal.timeout(120000),
      });
      const result = await upload.json();
      if (!upload.ok || !/^[a-f0-9-]{36}$/.test(result.uploadId || ''))
        throw Error(result.error || 'WEB_UPLOAD_FAILED');
      media = { ...media, uploadId: result.uploadId };
      replace(key, item.requestId, { media });
    }
    submitting = true;
    const response = await fetch('/api/zalo-team/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({
        accountId,
        conversationId,
        requestId: item.requestId,
        ...(item.reply ? { replyTo: item.reply.id } : {}),
        ...(media
          ? { media: { uploadId: media.uploadId } }
          : item.sticker
            ? { sticker: { id: item.sticker.id, categoryId: item.sticker.categoryId } }
            : {
                text: item.text,
                ...(item.styles?.length ? { styles: item.styles } : {}),
                ...(item.mentions?.length ? { mentions: item.mentions } : {}),
              }),
      }),
      signal: AbortSignal.timeout(media ? 190000 : 60000),
    });
    await packets<Receipt & { accountId: number; conversationId: string; requestId: string }>(
      response,
      (result) => {
        if (
          result.accountId !== accountId ||
          result.conversationId !== conversationId ||
          result.requestId !== item.requestId
        )
          throw Error('WEB_IDENTITY_MISMATCH');
        if (result.status === 'prepared') {
          replace(key, item.requestId, { receipt: result });
          return;
        }
        if (!['sent', 'failed', 'unknown'].includes(result.status)) throw Error('WEB_SEND_UNKNOWN');
        final = true;
        const status = result.status as 'sent' | 'failed' | 'unknown';
        replace(key, item.requestId, { status, receipt: result });
        update(key, {
          status,
          error:
            status === 'sent'
              ? ''
              : status === 'failed'
                ? 'Chưa gửi được tin nhắn. Nội dung được giữ tại bubble.'
                : 'Chưa xác nhận được kết quả. Kiểm tra trước khi gửi tiếp; không tự gửi lại.',
        });
      },
    );
    if (!final) throw Error('WEB_SEND_UNKNOWN');
  } catch (e) {
    if (!final) {
      const status =
        !submitting || (!check && e instanceof Error && preflight.has(e.message))
          ? 'failed'
          : 'unknown';
      replace(key, item.requestId, { status });
      update(key, {
        status,
        error:
          status === 'failed'
            ? 'Chưa gửi được tin nhắn. Bạn có thể thao tác lại tại tin nhắn.'
            : 'Chưa xác nhận được kết quả. Kiểm tra trước khi gửi tiếp; không tự gửi lại.',
      });
    }
  } finally {
    update(key, { busy: false, checking: false });
  }
}
async function pump(key: string, accountId: number, conversationId: string) {
  if (running.has(key)) return;
  running.add(key);
  try {
    while (!get(key).outgoing.some((item) => item.status === 'unknown')) {
      const next = get(key).outgoing.find((item) => item.status === 'queued');
      if (!next) break;
      await submit(key, accountId, conversationId, next, false);
    }
  } finally {
    running.delete(key);
  }
}
export function useSendDraft(
  accountId?: number,
  conversationId?: string,
  view: 'composer' | 'history' = 'composer',
) {
  const key = `${accountId}:${conversationId}`;
  const snapshot = useRef<{ key: string; value: Draft }>();
  const state = useSyncExternalStore(
    subscribe,
    () => {
      const current = get(key),
        previous = snapshot.current;
      // History depends on outbox/delivery and whether editing a failed text is
      // available, not on each character or caret change in the composer.
      if (view === 'history' && previous?.key === key) {
        const old = previous.value;
        if (
          old.outgoing === current.outgoing &&
          old.checking === current.checking &&
          old.busy === current.busy &&
          old.status === current.status &&
          old.error === current.error &&
          Boolean(old.text) === Boolean(current.text)
        )
          return old;
      }
      snapshot.current = { key, value: current };
      return current;
    },
    () => empty,
  );
  const change = (text: string, styles: RichStyle[] = [], mentions: Mention[] = noMentions) =>
    update(key, { text, styles, mentions });
  async function send(check = false) {
    if (!accountId || !conversationId) return;
    const current = get(key);
    const unresolved = current.outgoing.find((item) => item.status === 'unknown');
    if (check) {
      if (!unresolved || running.has(key)) return;
      running.add(key);
      try {
        await submit(key, accountId, conversationId, unresolved, true);
      } finally {
        running.delete(key);
      }
    } else {
      if (unresolved || current.checking || !current.text.trim()) return;
      const item: Outgoing = {
        requestId: requestId(),
        text: current.text,
        styles: current.styles,
        mentions: current.mentions,
        reply: current.reply,
        time: Date.now(),
        status: 'queued',
      };
      // Capture and clear synchronously: a second Enter on the empty composer cannot enqueue twice.
      update(key, {
        text: '',
        styles: [],
        mentions: [],
        reply: undefined,
        outgoing: [...current.outgoing, item],
        error: '',
      });
    }
    void pump(key, accountId, conversationId);
  }
  const editFailed = (id: string) => {
    const current = get(key),
      item = current.outgoing.find((x) => x.requestId === id && x.status === 'failed');
    if (
      (item?.sticker || item?.media) &&
      accountId &&
      conversationId &&
      !current.checking &&
      !current.outgoing.some((x) => x.status === 'unknown')
    ) {
      update(key, {
        error: '',
        outgoing: [
          ...current.outgoing.filter((x) => x !== item),
          {
            ...item,
            ...(item.media ? { media: { ...item.media, uploadId: undefined } } : {}),
            requestId: requestId(),
            receipt: undefined,
            time: Date.now(),
            status: 'queued',
          },
        ],
      });
      void pump(key, accountId, conversationId);
    } else if (item && !item.sticker && !item.media && !current.text)
      update(key, {
        text: item.text,
        styles: item.styles,
        mentions: item.mentions,
        reply: item.reply,
        error: '',
        outgoing: current.outgoing.filter((x) => x !== item),
      });
  };
  const sendLike = () => {
    if (!accountId || !conversationId) return;
    const current = get(key);
    if (current.checking || current.outgoing.some((item) => item.status === 'unknown')) return;
    update(key, {
      error: '',
      reply: undefined,
      outgoing: [
        ...current.outgoing,
        {
          requestId: requestId(),
          text: '/-strong',
          reply: current.reply,
          time: Date.now(),
          status: 'queued',
        },
      ],
    });
    void pump(key, accountId, conversationId);
  };
  const sendSticker = (sticker: StickerChoice) => {
    if (!accountId || !conversationId) return;
    const current = get(key);
    if (current.checking || current.outgoing.some((item) => item.status === 'unknown')) return;
    update(key, {
      error: '',
      reply: undefined,
      outgoing: [
        ...current.outgoing,
        {
          requestId: requestId(),
          text: '',
          sticker,
          reply: current.reply,
          time: Date.now(),
          status: 'queued',
        },
      ],
    });
    void pump(key, accountId, conversationId);
  };
  const sendFiles = (files: PickedAttachment[]) => {
    if (!accountId || !conversationId || !files.length) return false;
    const current = get(key);
    if (current.checking || current.outgoing.some((item) => item.status === 'unknown'))
      return false;
    update(key, {
      error: '',
      reply: undefined,
      outgoing: [
        ...current.outgoing,
        ...files.map(({ file, kind }): Outgoing => ({
          requestId: requestId(),
          text: '',
          reply: current.reply,
          time: Date.now(),
          status: 'queued',
          media: { file, kind, preview: kind === 'image' ? URL.createObjectURL(file) : undefined },
        })),
      ],
    });
    void pump(key, accountId, conversationId);
    return true;
  };
  const acknowledgeMedia = (messages: ChatMessage[]) => {
    const current = get(key);
    const completed = current.outgoing.filter(
      (item) =>
        item.status === 'sent' &&
        messages.some(
          (m) =>
            m.id === item.receipt?.messageId ||
            (!!item.receipt?.clientId && m.clientId === item.receipt.clientId),
        ),
    );
    if (!completed.length) return;
    for (const item of completed) if (item.media?.preview) URL.revokeObjectURL(item.media.preview);
    update(key, { outgoing: current.outgoing.filter((item) => !completed.includes(item)) });
  };
  return {
    ...state,
    blocked: state.checking || state.outgoing.some((item) => item.status === 'unknown'),
    change,
    setPastedImages: (pastedImages: File[]) => update(key, { pastedImages }),
    sendPastedImages: () => {
      const files = get(key).pastedImages;
      if (sendFiles(files.map((file) => ({ file, kind: 'image' })))) {
        update(key, { pastedImages: [] });
      }
    },
    setReply: (reply?: ReplyTarget) => update(key, { reply }),
    send,
    sendSticker,
    sendLike,
    sendFiles,
    acknowledgeMedia,
    editFailed,
  };
}
