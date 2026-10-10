import type { ChatMessage, MessagePage } from './types';
import { mergeStoredMedia } from './media-source';

export function compareMessages(
  a: Pick<ChatMessage, 'id' | 'time'>,
  b: Pick<ChatMessage, 'id' | 'time'>,
): number {
  return a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Native state wins; matching saved media provides a fallback for recent Web images. */
export function mergeTimelineMessages(stored: ChatMessage[], live: ChatMessage[]): ChatMessage[] {
  const items = new Map(stored.map((m) => [m.id, m]));
  for (const message of live) {
    const previous = items.get(message.id);
    if (message.clientId) {
      for (const [id, old] of items) {
        if (id !== message.id && old.clientId === message.clientId && old.time === message.time)
          items.delete(id);
      }
    }
    // A late archive response must not roll back fresh reactions, recall state or actions.
    if (message.archived && previous && !previous.archived) {
      if (!previous.crmSender && message.crmSender && previous.clientId === message.clientId && previous.time === message.time)
        items.set(message.id, { ...previous, crmSender: message.crmSender });
      continue;
    }
    const cached = message.archived ? undefined : previous;
    items.set(
      message.id,
      cached && cached.time === message.time && cached.clientId === message.clientId
        ? {
            ...message,
            crmSender: message.crmSender || cached.crmSender,
            attachments: message.attachments.map((a, i) => {
              const s = cached.attachments[i];
              if (!s || s.kind !== a.kind || s.name !== a.name || s.size !== a.size) return a;
              return mergeStoredMedia(a, s, message.time);
            }),
          }
        : message,
    );
  }
  return [...items.values()].sort(compareMessages);
}

export function mergeTimelinePage(
  live: MessagePage | null,
  stored: MessagePage | null,
  before?: MessagePage['cursor'],
): MessagePage {
  const scope = live || stored;
  if (!scope) throw Error('TIMELINE_UNAVAILABLE');
  if (
    live &&
    stored &&
    (live.accountId !== stored.accountId || live.conversationId !== stored.conversationId)
  )
    throw Error('WEB_IDENTITY_MISMATCH');
  const all = mergeTimelineMessages(stored?.messages || [], live?.messages || []).filter(
    (m) =>
      !before ||
      m.time < Number(before.time) ||
      (m.time === Number(before.time) && m.id < before.id),
  );
  // Cut at one common boundary. Returning both full pages could skip unseen messages
  // between the two source cursors on the next scroll.
  const frontiers = [live, stored].flatMap((p) =>
    p?.hasMore
      ? p.cursor
        ? [{ id: p.cursor.id, time: Number(p.cursor.time) }]
        : p.messages.length
          ? [[...p.messages].sort(compareMessages)[0]]
          : []
      : [],
  );
  const frontier = frontiers.sort(compareMessages).at(-1);
  // Source page sizes differ (native may return 15 while archive returns 50).
  // Never advance past the newest unfinished source boundary.
  const safe = frontier ? all.filter((m) => compareMessages(m, frontier) >= 0) : all;
  const messages = safe.slice(-50);
  const hasMore = all.length > 50 || !!live?.hasMore || !!stored?.hasMore;
  const first = messages[0];
  return {
    accountId: scope.accountId,
    conversationId: scope.conversationId,
    messages,
    cursor:
      hasMore && (first || frontier)
        ? { id: (first || frontier)!.id, time: String((first || frontier)!.time) }
        : null,
    hasMore: hasMore && !!(first || frontier),
    pins: live?.pins,
    warning: live?.warning || null,
  };
}
