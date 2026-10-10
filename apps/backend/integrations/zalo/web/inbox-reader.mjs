import { randomUUID } from 'node:crypto';

// A timeout releases callers, but retains the native in-flight operation until
// it settles. Retrying must never accumulate evaluations on a stalled page.
export class InboxReader {
  constructor({ now = Date.now, timeout = 8000, log = console.info } = {}) {
    this.now = now; this.timeout = timeout; this.log = log; this.entries = new Map();
  }
  forget(id) { this.entries.delete(id); }
  async read(slot, session, task) {
    let entry = this.entries.get(slot.id);
    if (!entry || entry.handle !== session.handle || entry.generation !== session.handle?.inboxGeneration) {
      const retained = entry?.handle === session.handle ? entry : null;
      entry = { handle: session.handle, generation: session.handle?.inboxGeneration,
        rows: retained?.rows || [], attempts: 0, firstFailure: null, lastSuccessAt: retained?.lastSuccessAt || null };
      this.entries.set(slot.id, entry);
    }
    if (entry.waiter) return entry.waiter;
    const started = this.now(), requestId = randomUUID();
    if (!entry.pending) {
      const pending = Promise.resolve().then(task);
      entry.pending = pending;
      pending.then(() => { if (entry.pending === pending) entry.pending = null; },
        () => { if (entry.pending === pending) entry.pending = null; });
    }
    const run = async () => {
      let timer;
      try {
        const rows = await Promise.race([entry.pending, new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error('WEB_READ_TIMEOUT:read_timeout')), this.timeout);
        })]);
        if (entry.handle !== session.handle || entry.generation !== session.handle?.inboxGeneration) throw Error('WEB_IDENTITY_MISMATCH');
        entry.rows = rows; entry.attempts = 0; entry.firstFailure = null;
        entry.lastSuccessAt = new Date(this.now()).toISOString();
        entry.nextRetryAt = null;
        return { rows, error: null, readiness: { state: 'ready', stage: 'ready', lastSuccessAt: entry.lastSuccessAt, requestId } };
      } catch (error) {
        const message = String(error?.message || '');
        const known = message.match(/\b(WEB_CONVERSATIONS_NOT_READY|WEB_CONVERSATIONS_ADAPTER_CHANGED|WEB_IDENTITY_MISMATCH|WEB_ACCOUNT_OFFLINE|WEB_READ_TIMEOUT)\b/);
        const code = known?.[1] || 'WEB_CONVERSATIONS_UNAVAILABLE';
        const stage = message.match(/:(frame_loading|modules_loading|privacy_loading|database_loading|preview_loading|read_timeout)\b/)?.[1] || 'list_read';
        entry.firstFailure ??= this.now(); entry.attempts++;
        const blocked = ['WEB_IDENTITY_MISMATCH', 'WEB_ACCOUNT_OFFLINE', 'WEB_CONVERSATIONS_ADAPTER_CHANGED'].includes(code);
        if (blocked) entry.rows = [];
        const delay = blocked ? null : Math.min(30000, 2000 * 2 ** Math.min(entry.attempts - 1, 4));
        entry.nextRetryAt = delay === null ? null : this.now() + delay;
        const readiness = {
          state: blocked ? 'action_required' : 'retry_wait', stage,
          attempts: entry.attempts, since: new Date(entry.firstFailure).toISOString(),
          lastSuccessAt: entry.lastSuccessAt, nextRetryAt: delay === null ? null : new Date(this.now() + delay).toISOString(),
          stale: entry.rows.length > 0, requestId,
        };
        // Whitelisted diagnostic fields only, never vendor errors or chat data.
        if (entry.lastCode !== code + stage || this.now() - (entry.lastLogAt || 0) >= 30000) {
          this.log(JSON.stringify({ event: 'inbox-read', requestId, accountId: slot.id, code, stage, ms: this.now() - started, attempt: entry.attempts }));
          entry.lastCode = code + stage; entry.lastLogAt = this.now(); entry.loggedRequestId = requestId;
        }
        readiness.requestId = entry.loggedRequestId || requestId;
        return { rows: entry.rows, error: code, readiness };
      } finally { clearTimeout(timer); }
    };
    entry.waiter = run();
    try { return await entry.waiter; } finally { entry.waiter = null; }
  }
}
