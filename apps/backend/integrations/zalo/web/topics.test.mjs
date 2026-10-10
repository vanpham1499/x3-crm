import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { TopicActions, validTopic, nativeTopic } from "./topics.mjs";
import { validCommand } from "./guards.mjs";
import { normalizeTopic } from "./messages.mjs";
const note = { kind: "note", title: "Ghi chú nhiều dòng\nDòng 2", pin: false };
const reminder = {
  kind: "reminder",
  title: "Nhắc hẹn",
  onlyMe: false,
  startTime: Date.now() + 3600000,
  repeat: "none",
  byDay: [],
};
const body = {
  owner: "a".repeat(64),
  action: "topic-action",
  accountId: 1,
  conversationId: "g123",
  requestId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  topic: note,
};
test("strict topic schema, UTF8 limits, repeat and request scope", () => {
  assert.ok(validCommand(body));
  assert.ok(validTopic(reminder));
  for (const topic of [
    { ...note, title: " " },
    { ...note, title: "ế".repeat(1300) },
    { ...note, pin: 1 },
    { ...note, url: "https://bad.test" },
    { ...reminder, byDay: ["MO"] },
    { ...reminder, repeat: "weeklyMultiDays", byDay: [] },
    { ...reminder, repeat: "weeklyMultiDays", byDay: ["MO", "MO"] },
  ])
    assert.equal(validTopic(topic), false);
  for (const b of [
    { ...body, requestId: undefined },
    { ...body, accountId: undefined },
    { ...body, conversationId: undefined },
    { ...body, text: "extra" },
    { ...body, action: "poll-action" },
  ])
    assert.equal(validCommand(b), false);
  assert.ok(
    validCommand({ ...body, topic: { kind: "catalog" }, requestId: undefined }),
  );
});
test("receipt prevents duplicates across restart and changed account; uncertain result is never resent", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zalo-topic-"));
  let calls = 0;
  const adapter = async (_, a) => {
    if (a.phase === "prepare") return {};
    calls++;
    throw Error("lost response");
  };
  try {
    assert.equal(
      (await new TopicActions(root, adapter).run(null, "1", body)).status,
      "unknown",
    );
    assert.equal(
      (await new TopicActions(root, adapter).run(null, "1", body)).status,
      "unknown",
    );
    assert.equal(calls, 1);
    await assert.rejects(
      new TopicActions(root, adapter).run(null, "2", { ...body, accountId: 2 }),
      /CONFLICT/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
function fixture() {
  const calls = [];
  const mods = {
    dThN: {
      default: {
        userId: "1",
        createGroupTopicv2: async (...a) => (calls.push(a), { id: "99" }),
      },
    },
    "1pet": { TEXT_TOPIC: 0, REPEAT_NONE: 0, REPEAT_DAILY: 1 },
    jDHv: {
      ModuleContainer: {
        resolve: () => ({ getList: () => ["g123"], isEnablePin: () => true }),
      },
    },
    iZzu: { ConvListController: {} },
    "3xbP": { c: "main" },
    Gm1y: {
      default: { getFullInfoGroupById: async () => ({ memberIds: ["1"] }) },
    },
    jnJr: {
      a: {
        getInstance: () => ({
          fetchTopics: async () => {},
          topicStore: { getTopics: () => [] },
          pinLimit: 3,
        }),
      },
    },
  };
  const req = {
    c: Object.fromEntries(
      Object.entries(mods).map(([k, exports]) => [k, { exports }]),
    ),
    m: {},
  };
  const ctx = vm.createContext({
    console,
    Date,
    Set,
    Map,
    globalThis: { webpackJsonp: {} },
  });
  const chunks = [];
  chunks.push = function (chunk) {
    chunk[1][chunk[0][0]]({}, {}, req);
    return Array.prototype.push.call(this, chunk);
  };
  ctx.globalThis.webpackJsonp = chunks;
  const page = {
    frames: () => [
      {
        url: () => "https://chat.zalo.me/",
        evaluate: (fn, args) =>
          vm.runInContext("(" + fn.toString() + ")", ctx)(args),
      },
    ],
  };
  return { page, calls };
}
test("native preflight checks account, membership, future time and unsupported private reminder before sending", async () => {
  const { page, calls } = fixture();
  const args = {
    expectedId: "1",
    conversationId: "g123",
    topic: reminder,
    phase: "apply",
  };
  await assert.rejects(
    nativeTopic(page, { ...args, expectedId: "2" }),
    /IDENTITY/,
  );
  await assert.rejects(
    nativeTopic(page, { ...args, conversationId: "g999" }),
    /CONVERSATION/,
  );
  await assert.rejects(
    nativeTopic(page, { ...args, topic: { ...reminder, onlyMe: true } }),
    /NOT_READY/,
  );
  await assert.rejects(
    nativeTopic(page, { ...args, topic: { ...reminder, startTime: 1 } }),
    /TIME_INVALID/,
  );
  assert.equal(calls.length, 0);
  assert.equal((await nativeTopic(page, args)).status, "confirmed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "123");
  assert.equal(calls[0][4], reminder.startTime);
  assert.equal(calls[0][8], 0);
});
test("topic projection keeps full multiline title and identifies reminder", () => {
  assert.equal(
    normalizeTopic(
      { id: "1", params: JSON.stringify({ title: note.title }), startTime: -1 },
      "update_board",
    ).title,
    note.title,
  );
  assert.equal(
    normalizeTopic(
      { id: "2", params: { title: "Reminder" }, startTime: 1790992800000 },
      "update_board",
    ).kind,
    "reminder",
  );
  assert.equal(
    normalizeTopic({ id: "1", params: { title: "removed" } }, "remove_board"),
    undefined,
  );
});
