'use client';
import { backgroundRead } from './request';
import { useEffect, useMemo, useState } from 'react';
import { archiveRequest } from './archive';
import { mergeStoredMedia } from './media-source';
import type { ChatMessage, MessageAttachment } from './types';

type StoredMessage = {
  id: string;
  time: number;
  clientId: string;
  attachments: MessageAttachment[];
};
export function useArchiveAttachments(
  messages: ChatMessage[],
  accountId?: number,
  conversationId?: string,
) {
  const [stored, setStored] = useState<{ scope: string; items: StoredMessage[] }>({
    scope: '',
    items: [],
  });
  const scope = `${accountId}:${conversationId}`;
  const ids = messages
    .filter((m) =>
      m.attachments.some((a) => a.kind !== 'link' && (!m.archived || a.archiveState !== 'ready')),
    )
    .map((m) => m.id)
    .join('|');
  useEffect(() => {
    if (!accountId || !conversationId || !ids) return;
    const abort = new AbortController();
    let busy = false;
    async function read() {
      if (busy) return;
      busy = true;
      try {
        const values = ids.split('|');
        const items: StoredMessage[] = [];
        for (let i = 0; i < values.length; i += 300) {
          const result = await archiveRequest<{ items: StoredMessage[] }>(
            {
              kind: 'attachment-status',
              accountId,
              conversationId,
              messageIds: values.slice(i, i + 300),
            },
            abort.signal,
          );
          items.push(...result.items);
        }
        if (!abort.signal.aborted) setStored({ scope, items });
      } catch {
        if (!abort.signal.aborted) setStored({ scope, items: [] });
      } finally {
        busy = false;
      }
    }
    const stop = backgroundRead(read, 60000);
    return () => {
      abort.abort();
      stop();
    };
  }, [accountId, conversationId, ids, scope]);
  return useMemo(() => {
    const byId = new Map((stored.scope === scope ? stored.items : []).map((m) => [m.id, m]));
    return messages.map((m) => {
      const saved = byId.get(m.id);
      if (!saved || Number(saved.time) !== m.time || saved.clientId !== m.clientId) return m;
      return {
        ...m,
        attachments: m.attachments.map((a, i) => {
          const s = saved.attachments[i];
          if (!s || s.kind !== a.kind || s.name !== a.name || s.size !== a.size) return a;
          return mergeStoredMedia(a, s, m.time, !m.archived);
        }),
      };
    });
  }, [messages, stored, scope]);
}
