// Transport policy for Team JSON reads. Commands and long-lived streams never
// join a read or replay automatically. No completed response cache / localStorage.
export const teamApiPolicy = {
  maxReads: 4,
  maxBackgroundReads: 2,
  readTimeout: 20000,
  accessInterval: 60000,
  archiveInterval: 60000,
  tagsInterval: 60000,
  eventBatch: 1000,
} as const;

function policy(url: string, body: any) {
  const endpoint = url.split('/').pop();
  if (endpoint === 'campaigns')
    return {
      read: ['bootstrap', 'list', 'detail', 'audience'].includes(body.kind),
      background: ['list', 'detail'].includes(body.kind),
    };
  if (endpoint === 'access') return { read: body.kind === 'scope', background: true };
  if (endpoint === 'workspace')
    return {
        read: ['read', 'summaries', 'lookup', 'notes', 'board'].includes(body.kind),
        background: ['summaries', 'board', 'presence'].includes(body.kind),
    };
  if (endpoint === 'tags') return { read: body.kind === 'read', background: true };
  if (endpoint === 'archive')
    return {
      read: [
        'status',
        'inbox-preferences',
        'days',
        'day-file-issues',
        'list-conversations',
        'search-conversations',
        'timeline',
        'history',
        'search-messages',
        'media-library',
        'attachment-status',
        'server-status',
        'file-status',
        'checkpoints',
        'dismissed-files',
      ].includes(body.kind),
      background: [
        'status',
        'days',
        'list-conversations',
        'attachment-status',
        'server-status',
        'file-status',
      ].includes(body.kind),
    };
  if (endpoint !== 'web') return { read: false, background: false };
  const action = body.action;
  return {
    read:
      [
        'conversations',
        'status',
        'conversation-info',
        'message-search',
        'mentions',
        'expressions',
      ].includes(action) ||
      (action === 'directory' &&
        ['friends', 'groups', 'search', 'profile', 'requests', 'invitations'].includes(
          body.directory?.kind,
        )) ||
      (action === 'friend-action' && ['search', 'status'].includes(body.friend?.kind)) ||
      (action === 'conversation-settings' &&
        ['read', 'privacy', 'hidden-list'].includes(body.settings?.kind)),
    background: action === 'directory' && ['friends', 'groups'].includes(body.directory?.kind),
  };
}

type Entry = {
  key: string;
  url: string;
  init: RequestInit;
  background: boolean;
  controller: AbortController;
  users: number;
  started: boolean;
  queuedAt: number;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
  promise: Promise<Response>;
  deadline: ReturnType<typeof setTimeout>;
};
const reads = new Map<string, Entry>();
const queue: Entry[] = [];
let active = 0,
  backgroundActive = 0;
let identity = '';
const abortError = () => new DOMException('Aborted', 'AbortError');

function discard(entry: Entry) {
  if (reads.get(entry.key) === entry) reads.delete(entry.key);
  const index = queue.indexOf(entry);
  if (index >= 0) queue.splice(index, 1);
  clearTimeout(entry.deadline);
}
function drain() {
  while (active < teamApiPolicy.maxReads) {
    let index = queue.findIndex((e) => !e.background);
    if (index < 0 && backgroundActive < teamApiPolicy.maxBackgroundReads) index = 0;
    if (index < 0 || !queue.length) return;
    const entry = queue.splice(index, 1)[0];
    if (entry.controller.signal.aborted) {
      discard(entry);
      continue;
    }
    entry.started = true;
    active++;
    if (entry.background) backgroundActive++;
    const start = Date.now();
    let status = 0,
      responseBytes = 0;
    void (async () => {
      try {
        const response = await fetch(entry.url, { ...entry.init, signal: entry.controller.signal });
        // Consume inside the deadline and pool; slow bodies count as active reads.
        const bytes = await response.arrayBuffer();
        status = response.status;
        responseBytes = bytes.byteLength;
        entry.resolve(
          new Response(response.status === 204 ? null : bytes, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          }),
        );
      } catch (error) {
        entry.reject(error);
      } finally {
        discard(entry);
        active--;
        if (entry.background) backgroundActive--;
        if (process.env.NODE_ENV === 'development') {
          const body = JSON.parse(String(entry.init.body || '{}'));
          console.debug(
            '[zalo-api]',
            JSON.stringify({
              endpoint: entry.url.split('/').pop(),
              operation: body.directory?.kind || body.action || body.kind,
              at: Date.now(),
              ms: Date.now() - start,
              queueMs: start - entry.queuedAt,
              totalMs: Date.now() - entry.queuedAt,
              status,
              bytes: responseBytes,
              aborted: entry.controller.signal.aborted,
              active,
              queued: queue.length,
            }),
          );
        }
        drain();
      }
    })();
  }
}

export function teamFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let body: any;
  try {
    body = JSON.parse(String(init.body || '{}'));
  } catch {
    return fetch(url, init);
  }
  const rules = policy(url, body);
  const headers = new Headers(init.headers);
  if (!rules.read || headers.get('Accept')?.includes('ndjson')) return fetch(url, init);
  const signal = init.signal;
  if (signal?.aborted) return Promise.reject(signal.reason || abortError());
  const key = JSON.stringify([identity, url, init.method || 'GET', body, [...headers.entries()]]);
  let entry = reads.get(key);
  if (!entry) {
    let resolve!: Entry['resolve'], reject!: Entry['reject'];
    const promise = new Promise<Response>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    entry = {
      key,
      url,
      init,
      background: rules.background,
      controller: new AbortController(),
      users: 0,
      started: false,
      queuedAt: Date.now(),
      promise,
      resolve,
      reject,
      deadline: undefined!,
    };
    const current = entry;
    entry.deadline = setTimeout(() => {
      current.controller.abort(new DOMException('Team read timed out', 'TimeoutError'));
      current.reject(current.controller.signal.reason);
      discard(current);
      drain();
    }, teamApiPolicy.readTimeout);
    reads.set(key, entry);
    queue.push(entry);
  }
  const current = entry;
  current.users++;
  const result = new Promise<Response>((resolve, reject) => {
    let done = false;
    const finish = (error?: unknown, response?: Response) => {
      if (done) return;
      done = true;
      signal?.removeEventListener('abort', cancel);
      current.users--;
      if (!current.users) {
        current.controller.abort();
        discard(current);
      }
      if (error) reject(error);
      else resolve(response!.clone());
    };
    const cancel = () => finish(signal?.reason || abortError());
    signal?.addEventListener('abort', cancel, { once: true });
    current.promise.then(
      (response) => finish(undefined, response),
      (error) => finish(error),
    );
  });
  drain();
  return result;
}

export function cancelTeamReads() {
  for (const entry of reads.values()) {
    entry.controller.abort();
    entry.reject(abortError());
    discard(entry);
  }
}

export function setTeamRequestIdentity(next: string) {
  if (identity === next) return;
  cancelTeamReads();
  identity = next;
}

// Completion-based polling: never overlaps, pauses in hidden/offline tabs, and
// refreshes once on return. Callers retain their own error/UI state.
export function backgroundRead(task: () => Promise<unknown>, interval: number) {
  let stopped = false,
    running = false,
    lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const available = () => !document.hidden && navigator.onLine !== false;
  const run = async () => {
    if (stopped || running) return;
    clearTimeout(timer);
    if (!available()) return;
    running = true;
    lastRun = Date.now();
    try {
      await task();
    } catch {
      /* Errors belong to the caller's UI. */
    } finally {
      running = false;
      if (!stopped && available()) timer = setTimeout(run, interval);
    }
  };
  const resume = () => {
    if (!available()) {
      clearTimeout(timer);
      return;
    }
    if (Date.now() - lastRun >= Math.min(interval, 5000)) void run();
    else if (!running) {
      clearTimeout(timer);
      timer = setTimeout(run, interval);
    }
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener('offline', resume);
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('offline', resume);
  };
}
