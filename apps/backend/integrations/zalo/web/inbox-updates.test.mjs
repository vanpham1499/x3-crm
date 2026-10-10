import { test } from "node:test";
import assert from "node:assert/strict";
import { InboxUpdates } from "./inbox-updates.mjs";
const row = (id, preview = "hello") => ({
  id: `1:${id}`,
  accountId: 1,
  conversationId: id,
  preview,
  updatedAt: 1,
});
const page = (rows, error = null) => ({
  accounts: [{ id: 1, state: "connected", count: rows.length, error }],
  conversations: rows,
});
const wait = () => new Promise((r) => setTimeout(r, 15));
test("native bursts with identical snapshots do not publish; changes contain only affected rows", async () => {
  let value = page([row("2"), row("3")]);
  const events = [];
  const updates = new InboxUpdates({
    read: async () => value,
    publish: (id, e) => events.push(e),
    delay: 1,
  });
  updates.baseline(1, value);
  for (let i = 0; i < 100; i++) updates.hint(1, { areas: ["inbox"] });
  await wait();
  assert.equal(updates.stats.reads, 1);
  assert.equal(events.length, 0);
  value = page([row("2", "changed"), row("3")]);
  updates.hint(1, { areas: ["inbox"] });
  await wait();
  assert.deepEqual(events[0].inbox.upserts, [row("2", "changed")]);
  assert.deepEqual(events[0].changes[0].conversationIds, ["2"]);
  value = page([row("3")]);
  updates.hint(1, { areas: ["inbox"] });
  await wait();
  assert.deepEqual(events[1].inbox.removed, ["1:2"]);
  updates.forget(1);
});
test("failed reads preserve row baseline, recovery can still remove a stale row", async () => {
  let value = page([row("2")]);
  const events = [];
  const updates = new InboxUpdates({
    read: async () => value,
    publish: (id, e) => events.push(e),
    delay: 1,
  });
  updates.baseline(1, value);
  value = page([], "WEB_CONVERSATIONS_UNAVAILABLE");
  updates.hint(1, { areas: ["inbox"] });
  await wait();
  assert.deepEqual(events[0].inbox.removed, []);
  value = page([]);
  updates.hint(1, { areas: ["inbox"] });
  await wait();
  assert.deepEqual(events[1].inbox.removed, ["1:2"]);
  updates.forget(1);
});
test("reaction/recall events update their conversation even with unchanged preview", async () => {
  const value = page([row("2")]);
  const events = [];
  const updates = new InboxUpdates({
    read: async () => value,
    publish: (id, e) => events.push(e),
    delay: 1,
  });
  updates.baseline(1, value);
  updates.hint(1, { areas: ["messages"], conversationIds: ["2"] });
  await wait();
  assert.equal(events[0].inbox, undefined);
  assert.deepEqual(events[0].changes, [
    { accountId: 1, areas: ["messages"], conversationIds: ["2"] },
  ]);
  updates.forget(1);
});
test("in-flight hints collapse into one followup; forgotten account cannot publish", async () => {
  let release;
  let reads = 0;
  const events = [];
  const updates = new InboxUpdates({
    read: async () => {
      reads++;
      return new Promise((r) => (release = r));
    },
    publish: (id, e) => events.push(e),
    delay: 1,
  });
  updates.hint(1);
  await wait();
  for (let i = 0; i < 10; i++) updates.hint(1);
  assert.equal(reads, 1);
  release(page([]));
  await wait();
  assert.equal(reads, 2);
  updates.forget(1);
  release(page([row("2")]));
  await wait();
  assert.equal(events.length, 1);
});
