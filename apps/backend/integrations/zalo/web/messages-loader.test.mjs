import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readMessages, normalizeMessage } from "./messages.mjs";

test("reaction projection preserves people and self identity across reaction types", () => {
  const raw = {
    type: "MSG_TEXT",
    message: "test",
    reactions: { 0: { 3: 1 }, 12: { 3: 2, 5: 1 }, 13: { 5: 1 } },
    reactionUsers: {
      0: { id: "10", name: "Bạn", mine: true },
      12: { id: "12", name: "Người kiểm thử", mine: false },
    },
  };
  const reactions = normalizeMessage(raw).reactions;
  assert.equal(reactions.find((r) => r.type === 3).count, 3);
  assert.equal(reactions.find((r) => r.type === 3).mine, true);
  assert.deepEqual(
    reactions.find((r) => r.type === 3).users.map((u) => u.name),
    ["Bạn", "Người kiểm thử"],
  );
  assert.equal(
    reactions.find((r) => r.type === 5).users[1].name,
    "Người dùng Zalo",
  );
  assert.equal(
    normalizeMessage({ ...raw, type: "MSG_UNDO" }).reactions.length,
    0,
  );
});

test("GIF keeps animated original distinct from static thumbnail; file stays file", () => {
  const raw = {
    type: "MSG_GIF",
    message: {
      href: "https://example.com/original",
      thumb: "https://example.com/preview.jpg",
    },
  };
  const gif = normalizeMessage(raw).attachments[0];
  assert.equal(gif.animated, true);
  assert.equal(gif.url, "https://example.com/original");
  assert.equal(gif.preview, "https://example.com/preview.jpg");
  assert.equal(
    normalizeMessage({ ...raw, type: "MSG_FILE" }).attachments[0].kind,
    "file",
  );
});

function fixture(photo = false, poll = false) {
  let release,
    parsed = 0,
    topCursor;
  const pending = new Promise((r) => {
    release = r;
  });
  const message = (id) => ({
    msgId: String(id),
    sendDttm: id,
    fromUid: "0",
    msgType: poll ? 26 : photo ? 2 : 1,
    message: poll
      ? { action: "create", params: JSON.stringify({ pollId: 9 }) }
      : photo
        ? {
            href: "https://example.com/photo.png",
            thumb: "https://example.com/thumb.png",
          }
        : `Text ${id}`,
  });
  class Native {
    constructor(id) {
      this.id = id;
    }
    dispatchRows(rows, more) {
      this.dispatch({
        payload: {
          conversationId: this.id,
          messages: rows,
          hasMoreLocal: more,
          hasMoreCloud: false,
        },
      });
    }
    async getLastMessagesForConversation() {
      this.dispatchRows([message(2)], true);
      await pending;
      this.dispatchRows([message(2), message(3)], true);
    }
    async loadTopMessagesForConversation() {
      topCursor = this.getState().messages[0].msgId;
      this.dispatchRows([message(1)], false);
    }
    async loadLastMessageLocalFrom() {
      return { messages: [message(3)], hasMore: true };
    }
  }
  const exports = {
    dThN: {
      default: {
        userId: "100",
        fetchPollIfNotExist: async () => ({
          poll_id: 9,
          question: "Question",
          options: [
            { option_id: 1, content: "A", votes: 0 },
            { option_id: 2, content: "B", votes: 0 },
          ],
        }),
      },
    },
    jDHv: { ModuleContainer: { resolve: () => ({ getList: () => ["200"] }) } },
    iZzu: { ConvListController: {} },
    "3xbP": { c: "all" },
    ZCU6: { d: Native },
    "Y/Cm": {
      a: {
        doParse: async (rows) => {
          parsed++;
          return rows;
        },
      },
    },
    "1pet": {
      MSG_TEXT: 1,
      MSG_POLL: 26,
      MSG_PHOTO: 2,
      MSG_TOPIC: 2,
      MessageConstants: { MAX_MSG_ID: "max", MAX_SENDDTTM: "max" },
    },
    UiPd: {
      default: { getDName: () => "Fixture", getAvatar: () => undefined },
    },
    P6UB: { default: { getPlainText: (m) => m.message } },
  };
  const req = {
    c: Object.fromEntries(
      Object.entries(exports).map(([k, v]) => [k, { exports: v }]),
    ),
    m: {},
  };
  const chunks = [];
  chunks.push = (chunk) => {
    Array.prototype.push.call(chunks, chunk);
    Object.values(chunk[1])[0]({}, {}, req);
  };
  const context = vm.createContext({
    webpackJsonp: chunks,
    setTimeout,
    clearTimeout,
    console,
  });
  const frame = {
    url: () => "https://chat.zalo.me/",
    evaluate: (fn, arg) => vm.runInContext(`(${fn.toString()})`, context)(arg),
  };
  const page = {
    frames: () => [frame],
    exposeBinding: async (key, callback) => {
      context[key] = (...args) => callback({ frame }, ...args);
    },
  };
  return { page, release, parsed: () => parsed, topCursor: () => topCursor };
}

test("native cache is emitted before cloud finishes; final merges IDs without reparsing native output", async () => {
  const f = fixture(),
    packets = [];
  let first;
  const available = new Promise((r) => {
    first = r;
  });
  const done = readMessages(f.page, "100", "200", undefined, (packet) => {
    packets.push(packet);
    first();
  });
  await available;
  f.release();
  assert.deepEqual(
    Array.from(packets[0].messages, (m) => m.id),
    ["2"],
  );
  const result = await done;
  assert.deepEqual(
    Array.from(result.messages, (m) => m.id),
    ["2", "3"],
  );
  assert.equal(f.parsed(), 0);
});

test("photo message kind does not collide with the pinned-topic subtype", async () => {
  const f = fixture(true);
  const result = await readMessages(f.page, "100", "200", {
    id: "2",
    time: "2",
  });
  assert.equal(result.messages[0].type, "MSG_PHOTO");
  assert.equal(result.messages[0].kind, "media");
  assert.equal(
    result.messages[0].attachments[0].url,
    "https://example.com/photo.png",
  );
});
test("native numeric poll event is mapped to a poll card with choices", async () => {
  const f = fixture(false, true);
  const result = await readMessages(f.page, "100", "200", {
    id: "2",
    time: "2",
  });
  assert.equal(result.messages[0].type, "MSG_POLL");
  assert.equal(result.messages[0].kind, "poll");
  assert.equal(result.messages[0].poll.options.length, 2);
  assert.match(result.messages[0].text, /tạo cuộc bình chọn mới/);
});

test("older pages use native top loader cursor; refresh parses cache once; identity mismatch rejected", async () => {
  const f = fixture();
  const older = await readMessages(f.page, "100", "200", {
    id: "2",
    time: "2",
  });
  assert.equal(f.topCursor(), "2");
  assert.equal(older.cursor, null);
  assert.equal(older.messages[0].id, "1");
  const refresh = await readMessages(
    f.page,
    "100",
    "200",
    undefined,
    undefined,
    true,
  );
  assert.equal(refresh.messages[0].id, "3");
  assert.equal(f.parsed(), 1);
  await assert.rejects(
    readMessages(f.page, "101", "200"),
    /WEB_IDENTITY_MISMATCH/,
  );
  await assert.rejects(
    readMessages(f.page, "100", "201"),
    /WEB_CONVERSATION_NOT_FOUND/,
  );
});
