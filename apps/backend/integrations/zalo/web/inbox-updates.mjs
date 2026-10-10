// Compare normalized snapshots once per account, independent of browser count.
// No payloads are logged or persisted; the profile's normalized inbox is the source.
export class InboxUpdates {
  constructor({ read, publish, delay = 300 }) {
    this.read = read;
    this.publish = publish;
    this.delay = delay;
    this.entries = new Map();
    this.stats = { hints: 0, reads: 0, unchanged: 0, published: 0 };
  }
  entry(id) {
    if (!this.entries.has(id))
      this.entries.set(id, {
        rows: new Map(),
        state: "",
        pending: false,
        areas: new Set(),
        ids: new Set(),
      });
    return this.entries.get(id);
  }
  baseline(id, result) {
    const e = this.entry(id);
    if (e.running) return; // The in-flight diff owns its comparison baseline.
    this.remember(e, result);
  }
  remember(e, result) {
    e.rows = new Map(
      result.conversations.map((row) => [row.id, JSON.stringify(row)]),
    );
    e.state = this.state(result.accounts[0]);
  }
  state(a) {
    return JSON.stringify(
      a && [a.id, a.name, a.avatarSrc, a.state, a.count, a.error],
    );
  }
  hint(id, hint = {}) {
    this.stats.hints++;
    const e = this.entry(id);
    e.pending = true;
    for (const area of hint.areas || []) e.areas.add(area);
    if ((hint.areas || []).some((a) => a !== "inbox")) {
      if (!Array.isArray(hint.conversationIds) || !hint.conversationIds.length)
        e.all = true;
      else
        for (const cid of hint.conversationIds)
          if (/^g?\d{1,30}$/.test(cid)) e.ids.add(cid);
    }
    if (!e.timer && !e.running)
      e.timer = setTimeout(() => void this.flush(id), this.delay);
  }
  async flush(id) {
    const e = this.entry(id);
    clearTimeout(e.timer);
    e.timer = null;
    if (e.running || !e.pending) return;
    e.running = true;
    e.pending = false;
    const areas = [...e.areas],
      ids = e.all ? undefined : [...e.ids];
    e.areas.clear();
    e.ids.clear();
    e.all = false;
    try {
      this.stats.reads++;
      const result = await this.read(id);
      if (this.entries.get(id) !== e) return;
      const current = new Map(
        result.conversations.map((row) => [row.id, JSON.stringify(row)]),
      );
      const upserts = result.conversations.filter(
        (row) => e.rows.get(row.id) !== current.get(row.id),
      );
      // An unavailable source is not proof that conversations were removed.
      const ok = result.accounts[0]?.error === null;
      const removed =
        ok || result.accounts[0]?.error === "WEB_IDENTITY_MISMATCH"
          ? [...e.rows.keys()].filter((key) => !current.has(key))
          : [];
      const stateChanged = e.state !== this.state(result.accounts[0]);
      const inboxChanged = upserts.length || removed.length || stateChanged;
      const messageIds = upserts
        .filter((row) => {
          const old = e.rows.get(row.id);
          if (!old) return true;
          const before = JSON.parse(old);
          return (
            before.updatedAt !== row.updatedAt || before.preview !== row.preview
          );
        })
        .map((row) => row.conversationId);
      const previousRows = e.rows;
      this.remember(e, result);
      if (!ok && result.accounts[0]?.error !== "WEB_IDENTITY_MISMATCH")
        e.rows = new Map([...previousRows, ...e.rows]);
      const relevant = areas.filter((a) => a !== "inbox");
      if (inboxChanged || relevant.length) {
        this.stats.published++;
        this.publish(id, {
          ...(inboxChanged
            ? { inbox: { account: result.accounts[0], upserts, removed } }
            : {}),
          changes: [
            ...(relevant.length
              ? [{ accountId: id, areas: relevant, conversationIds: ids }]
              : []),
            ...(messageIds.length
              ? [
                  {
                    accountId: id,
                    areas: ["messages", "info"],
                    conversationIds: messageIds,
                  },
                ]
              : []),
          ],
        });
      } else this.stats.unchanged++;
    } catch {
      // Preserve the last good snapshot. A bounded state/read retry can recover.
      this.publish(id, { changes: [{ accountId: id, areas: ["inbox"] }] });
    } finally {
      e.running = false;
      if (e.pending && this.entries.get(id) === e)
        e.timer = setTimeout(() => void this.flush(id), this.delay);
    }
  }
  forget(id) {
    clearTimeout(this.entries.get(id)?.timer);
    this.entries.delete(id);
  }
}
