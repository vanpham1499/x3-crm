import { archiveRequest } from './archive';
import { packets } from './live';
import { compareMessages, mergeTimelinePage } from './timeline-merge';
import type { MessagePage } from './types';

export async function readTimelinePage(
  accountId: number,
  conversationId: string,
  before: MessagePage['cursor'] | undefined,
  refresh: boolean,
  signal: AbortSignal,
  nativeEnd?: MessagePage['cursor'],
  storedOnly = false,
  onPartial?: (page: MessagePage) => void,
): Promise<MessagePage & { nativeEnd?: MessagePage['cursor'] }> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  let native: MessagePage | null = null;
  let stored: MessagePage | null = null;
  let liveError: unknown;
  let archiveError: unknown;
  let boundary: MessagePage['cursor'] | undefined;
  const archiveOnly =
    storedOnly ||
    !!(
      before &&
      nativeEnd &&
      (Number(before.time) < Number(nativeEnd.time) ||
        (before.time === nativeEnd.time && before.id <= nativeEnd.id))
    );
  const preview = () => {
    // Only the first page can paint early. Pagination waits for both sources so
    // the history cursor cannot skip unseen messages at their boundary.
    if (before || refresh || signal.aborted || !onPartial) return;
    const page = mergeTimelinePage(native, stored, before);
    if (page.messages.length) onPartial({...page, cursor:null, hasMore:false, warning:'WEB_HISTORY_PARTIAL'});
  };
  const nativeAbort = new AbortController();
  const abortNative = () => nativeAbort.abort();
  signal.addEventListener('abort', abortNative, { once: true });
  let deadline = setTimeout(abortNative, 12000);
  try {
    await Promise.all([
      (async () => {
        try {
          if (archiveOnly) {
            native = {
              accountId,
              conversationId,
              messages: [],
              cursor: null,
              hasMore: false,
              warning: null,
            };
            boundary = nativeEnd;
            return;
          }
          const response = await fetch('/api/zalo-team/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
            body: JSON.stringify({
              accountId,
              conversationId,
              ...(before ? { before } : { refresh }),
            }),
            signal: nativeAbort.signal,
          });
          await packets<MessagePage & { partial?: boolean }>(response, (page) => {
            if (page.accountId !== accountId || page.conversationId !== conversationId)
              throw Error('WEB_IDENTITY_MISMATCH');
            if (
              before &&
              page.hasMore &&
              page.cursor &&
              compareMessages(
                { id: page.cursor.id, time: Number(page.cursor.time) },
                { id: before.id, time: Number(before.time) },
              ) >= 0
            )
              throw Error('WEB_HISTORY_NOT_ADVANCED');
            native = { ...page, warning: page.partial ? 'WEB_HISTORY_PARTIAL' : page.warning };
            preview();
            if (!page.partial && !page.warning) {
              const first = [...page.messages].sort(
                (a, b) => a.time - b.time || (a.id < b.id ? -1 : 1),
              )[0];
              boundary = page.hasMore
                ? null
                : first
                  ? { id: first.id, time: String(first.time) }
                  : before || { id: '~', time: String(Number.MAX_SAFE_INTEGER) };
            }
          });
        } catch (e) {
          liveError = e;
        } finally {
          clearTimeout(deadline);
        }
      })(),
      (async () => {
        try {
          stored = await archiveRequest<MessagePage>(
            { kind: 'timeline', accountId, conversationId, ...(before ? { before } : {}) },
            AbortSignal.any([signal, AbortSignal.timeout(12000)]),
          );
          if (stored.accountId !== accountId || stored.conversationId !== conversationId)
            throw Error('WEB_IDENTITY_MISMATCH');
          preview();
          if (stored.messages.length) {
            clearTimeout(deadline);
            deadline = setTimeout(abortNative, 3000);
          }
        } catch (e) {
          archiveError = e;
          stored = null;
        }
      })(),
    ]);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (liveError instanceof Error && liveError.message === 'WEB_IDENTITY_MISMATCH')
      throw liveError;
    const page = mergeTimelinePage(native, stored, before);
    if (!page.messages.length && (liveError || archiveError)) throw liveError || archiveError;
    if (liveError) page.warning = 'ARCHIVE_FALLBACK';
    else if (archiveError) page.warning = 'ARCHIVE_UNAVAILABLE';
    // A failed source cannot prove the beginning of history. Keep a retryable boundary.
    if ((liveError || archiveError) && page.messages.length && !page.cursor) {
      const first = page.messages[0];
      page.cursor = { id: first.id, time: String(first.time) };
      page.hasMore = true;
    }
    return { ...page, ...(liveError ? {} : { nativeEnd: boundary }) };
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener('abort', abortNative);
  }
}
