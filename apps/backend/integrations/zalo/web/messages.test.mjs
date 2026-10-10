import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readMessages, normalizeMessage } from "./messages.mjs";
import { validCommand } from "./guards.mjs";
import { Accounts } from "./accounts.mjs";

function fixture({ failCloud = false } = {}) {
  const all = Array.from({ length: 75 }, (_, i) => ({
    msgId: String(9007199254740993000n + BigInt(i)),
    cliMsgId: String(i),
    sendDttm: "1790781600000",
    msgType: 1,
    message: "Message " + i,
    fromUid: i % 2 ? "0" : "42",
  }));
  all[74].message = "Hi 🐷";
  let reads = 0;
  const modules = {
    dThN: { default: { userId: "123" } },
    jDHv: { ModuleContainer: { resolve: () => ({ getList: () => ["g42"] }) } },
    iZzu: { ConvListController: {} },
    "3xbP": { c: "main" },
    "1pet": { MSG_TEXT: 1, MSG_SUBTYPE_PHOTO: 1 },
    P6UB: {
      TokenTypes: { EMOJI_TOKEN: 2, EMOJI_TOKEN_V2: 3 },
      default: {
        getPlainText: (m) => m.message,
        parseMessage: ({ message }) =>
          message === "Hi 🐷"
            ? ["Hi ", { type: 3, value: ":pig:", text: "🐷" }]
            : [message],
      },
    },
    NDmK: { default: { emojiMapPos: { ":pig:": "2% 4%" } } },
    z0WU: {
      default: { getEmojiSrc: () => "https://res-zalo.zadn.vn/emoji.png" },
    },
    "4wTQ": {
      default: {
        getLastMessagesForConversation: async () => {
          if (failCloud) throw Error();
        },
      },
    },
    "Y/Cm": { a: { doParse: async (rows) => rows } },
    "Vd+K": {
      b: {
        getMessageFromConversationByLimit: async (id, count, options) => {
          reads++;
          assert.equal(id, "g42");
          if (options.fromMsg) assert.equal(options.include, false);
          return all
            .filter(
              (m) =>
                !options.fromMsg ||
                BigInt(m.msgId) < BigInt(options.fromMsg.msgId),
            )
            .slice(-count);
        },
      },
    },
    UiPd: {
      default: {
        getDName: (id) => (id === "123" ? "Owner" : "Member"),
        getAvatar: () => "https://example.com/avatar",
      },
    },
  };
  modules.ZCU6 = { d: class {
    constructor(conversationId) { this.conversationId = conversationId; }
    async load(before) {
      const rows = await modules['Vd+K'].b.getMessageFromConversationByLimit(this.conversationId,50,{fromMsg:before,include:false});
      this.dispatch({payload:{conversationId:this.conversationId,messages:rows,hasMoreLocal:rows.length===50,hasMoreCloud:false}});
      if(failCloud) throw Error('Cloud unavailable');
    }
    getLastMessagesForConversation() { return this.load(); }
    loadTopMessagesForConversation() { return this.load(this.getState().messages[0]); }
  }};
  const page = {
    exposeBinding: async () => {},
    frames: () => [
      {
        url: () => "https://chat.zalo.me/",
        evaluate: (fn, arg) => {
          const require = {
            c: Object.fromEntries(
              Object.entries(modules).map(([key, exports]) => [
                key,
                { exports },
              ]),
            ),
            m: {},
          };
          const chunks = [];
          chunks.push = (chunk) => {
            Array.prototype.push.call(chunks, chunk);
            Object.values(chunk[1])[0]({}, {}, require);
          };
          return vm.runInNewContext(`(${fn.toString()})(arg)`, {
            arg,
            webpackJsonp: chunks,
            __zaloTeamPacket: async () => {},
            setTimeout,
            clearTimeout,
            URL,
          });
        },
      },
    ],
  };
  return { page, reads: () => reads };
}
test("history pages use exclusive timestamp/large-ID cursor and canonical type constants", async () => {
  const { page } = fixture();
  const first = await readMessages(page, "123", "g42");
  assert.equal(first.messages.length, 50);
  assert.equal(first.hasMore, true);
  assert.equal(first.messages[0].type, "MSG_TEXT");
  assert.equal(first.messages[0].id, "9007199254740993025");
  assert.equal(first.messages[0].mine, true);
  assert.equal(first.messages[0].sender.id, "123");
  assert.equal(first.messages.at(-1).inline[1].text, "🐷");
  assert.equal(first.messages.at(-1).inline[1].position, "2% 4%");
  const second = await readMessages(page, "123", "g42", first.cursor);
  assert.equal(second.messages.length, 25);
  assert.equal(second.hasMore, false);
  assert.equal(
    second.messages.filter((m) => first.messages.some((n) => n.id === m.id))
      .length,
    0,
  );
});
test("identity or non-inbox conversation cannot read a message partition", async () => {
  const f = fixture();
  await assert.rejects(
    readMessages(f.page, "other", "g42"),
    /WEB_IDENTITY_MISMATCH/,
  );
  await assert.rejects(
    readMessages(f.page, "123", "g43"),
    /WEB_CONVERSATION_NOT_FOUND/,
  );
  assert.equal(f.reads(), 0);
});
test("failed native history load preserves available messages with an explicit warning", async () => {
  const result = await readMessages(
    fixture({ failCloud: true }).page,
    "123",
    "g42",
  );
  assert.equal(result.messages.length, 50);
  assert.equal(result.warning, "WEB_HISTORY_LOAD_INCOMPLETE");
});
test("normalizer retains plain text, media and quote while excluding unsafe links and raw payload", () => {
  const raw = { id: "1", time: 1, mine: false, sender: { name: "A" } };
  const photo = normalizeMessage({
    ...raw,
    type: "MSG_PHOTO",
    message: {
      oriUrl: "https://example.com/full",
      thumbUrl: "https://example.com/thumb",
    },
  });
  assert.equal(photo.attachments[0].url, "https://example.com/full");
  const message = normalizeMessage({
    ...raw,
    type: "MSG_TEXT",
    message: "raw",
    plainText: "@Member hello",
    quote: { ownerName: "B", msg: "quoted" },
  });
  assert.equal(message.text, "@Member hello");
  assert.equal(message.quote.text, "quoted");
  const unsafe = normalizeMessage({
    ...raw,
    type: "MSG_FILE",
    message: {
      href: "javascript:alert(1)",
      params: { secret: "not-for-client" },
    },
  });
  assert.equal(unsafe.attachments[0].url, undefined);
  assert.equal("message" in unsafe, false);
  const call = normalizeMessage({
    ...raw,
    type: "MSG_CONTACT",
    message: { action: "recommened.calltime" },
    plainText: "Cuộc gọi 1 phút",
  });
  assert.equal(call.kind, "call");
  assert.equal(call.text, "Cuộc gọi 1 phút");
});
test("message commands require an account and validate cursors", () => {
  const cmd = {
    action: "messages",
    owner: "a".repeat(64),
    accountId: 1,
    conversationId: "g42",
  };
  assert.equal(validCommand(cmd), true);
  for (const change of [
    { accountId: undefined },
    { conversationId: "../other" },
    { before: {} },
    { before: { id: 123, time: "1" } },
    { before: { id: "1", time: "-1" } },
  ])
    assert.equal(validCommand({ ...cmd, ...change }), false);
});
test("emoji projection preserves text and restricts sprite URLs and positions", () => {
  const raw = {
    id: "1",
    time: 1,
    type: "MSG_TEXT",
    message: "Hi :)",
    inline: [
      { text: "Hi " },
      {
        text: ":)",
        sprite: "https://res-zalo.zadn.vn/emoji.png",
        position: "2% 4%",
      },
    ],
  };
  assert.equal(normalizeMessage(raw).inline[1].position, "2% 4%");
  const unsafe = normalizeMessage({
    ...raw,
    inline: [
      { text: "Hi " },
      { text: ":)", sprite: "https://evil.example/track", position: "2% 4%" },
    ],
  });
  assert.equal(unsafe.inline[1].sprite, undefined);
  assert.deepEqual(
    normalizeMessage({ ...raw, inline: [{ text: "truncated" }] }).inline,
    [],
  );
});
test("history is routed only to the owned connected account", async () => {
  const owner = "a".repeat(64),
    record = {
      owner,
      slots: [
        {
          id: 1,
          enabled: true,
          account: {
            id: 1,
            externalId: "123",
            name: "A",
            updatedAt: new Date().toISOString(),
          },
        },
      ],
    };
  const calls = [];
  const manager = new Accounts(record, {
    save: async () => {},
    inspect: async () => ({ state: "connected", externalId: "123", name: "A" }),
    readMessages: async (...args) => {
      calls.push(args);
      return { messages: [] };
    },
  });
  manager.session(record.slots[0]).handle = { page: "A" };
  const cmd = {
    owner,
    action: "messages",
    accountId: 1,
    conversationId: "g42",
  };
  await manager.command(cmd);
  assert.equal(calls[0][1], "123");
  assert.equal(calls[0][2], "g42");
  await assert.rejects(
    manager.command({ ...cmd, owner: "b".repeat(64) }),
    /WEB_OWNED/,
  );
  await assert.rejects(
    manager.command({ ...cmd, accountId: 2 }),
    /ACCOUNT_NOT_FOUND/,
  );
  record.slots[0].enabled = false;
  manager.session(record.slots[0]).handle = null;
  await assert.rejects(manager.command(cmd), /WEB_ACCOUNT_OFFLINE/);
  assert.equal(calls.length, 1);
});
