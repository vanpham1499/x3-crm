'use client';
import { teamFetch, teamApiPolicy } from './request';
import { mergeChanges, type Change } from './changes';
export { affects } from './changes';

export async function packets<T>(response: Response, receive: (value: T) => void) {
  if (!response.ok) {
    const error = await response.json();
    throw Error(error.error || 'WEB_UNAVAILABLE');
  }
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    receive(await response.json());
    return;
  }
  const reader = response.body!.getReader(),
    decoder = new TextDecoder();
  let buffer = '';
  const consume = (line: string) => {
    if (!line.trim()) return;
    const value = JSON.parse(line);
    if (value.error && value.status !== 'failed') throw Error(value.error);
    receive(value);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        consume(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
      if (done) {
        consume(buffer);
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

const listeners = new Set<(event: Change) => void>();
let connection: AbortController | undefined;
let revision: number | undefined;
let failed = false;
let batch: ReturnType<typeof setTimeout> | undefined;
let pending: Change | undefined;
const visible = () => typeof document === 'undefined' || !document.hidden;
function flush() {
  batch = undefined;
  if (!visible() || !pending) return;
  const event = pending;
  pending = undefined;
  listeners.forEach((fn) => fn(event));
}
function receive(event: Change) {
  if (event.error) {
    if (!failed) listeners.forEach((fn) => fn(event));
    failed = true;
    return;
  }
  const reconnect = event.resync;
  const changed = revision !== undefined && event.revision !== revision;
  revision = event.revision;
  // A new stream sends its revision even when nothing changed. The initial
  // page load already reads data, so neither handshake needs another full read.
  if (reconnect && !changed && !failed) return;
  failed = false;
  pending = mergeChanges(pending, event);
  if (!batch && visible()) batch = setTimeout(flush, teamApiPolicy.eventBatch);
}
function connect() {
  if (connection) return;
  const controller = (connection = new AbortController());
  void (async () => {
    let retry = 1000;
    while (!controller.signal.aborted) {
      try {
        const response = await teamFetch('/api/zalo-team/web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
          body: JSON.stringify({ action: 'events' }),
          signal: controller.signal,
        });
        await packets<Change>(response, (event) => {
          if (connection === controller && !controller.signal.aborted) receive(event);
        });
        retry = 1000;
      } catch {
        if (connection === controller && !controller.signal.aborted)
          receive({ error: 'WEB_EVENTS_UNAVAILABLE' });
        retry = Math.min(retry * 2, 30000);
      }
      if (!controller.signal.aborted)
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            controller.signal.removeEventListener('abort', done);
            resolve();
          };
          const timer = setTimeout(done, retry);
          controller.signal.addEventListener('abort', done, { once: true });
        });
    }
  })();
}
export function reconnectChanges() {
  connection?.abort();
  connection = undefined;
  if (listeners.size) connect();
}
export function subscribeChanges(listener: (event: Change) => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof document !== 'undefined')
    document.addEventListener('visibilitychange', flush);
  connect();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      connection?.abort();
      connection = undefined;
      clearTimeout(batch);
      batch = undefined;
      pending = undefined;
      revision = undefined;
      failed = false;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', flush);
    }
  };
}
