import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { searchInPage, validMessageSearch } from "./message-search.mjs";
import { validCommand } from "./guards.mjs";
const now = Date.now();
const row = (id, text, from = "0", time = now, type = 1) => ({
  msgId: String(id),
  sendDttm: String(time),
  message: text,
  fromUid: from,
  msgType: type,
});
function run(rows, search = {}, scope = {}) {
  const modules = {
    dThN: { default: { userId: "100" } },
    jDHv: { ModuleContainer: { resolve: () => ({ getList: () => ["200"] }) } },
    iZzu: { ConvListController: {} },
    "3xbP": { c: 1 },
    mlG1: {
      d: {
        isDeletingInConversation: (m) => !!m.deleting,
        isDeleteMessage: (conv, m) => !!m.deleted,
      },
    },
    "1pet": { MSG_UNDO: 9, MSG_FILE: 2 },
    UiPd: { default: { getDName: (id) => "Member " + id } },
    P6UB: {
      default: {
        getPlainText: (m) =>
          typeof m.message === "string" ? m.message : m.message?.title || "",
      },
    },
    XS0u: {
      default: {
        getMessageFromConversationByLimit: async (conv, limit, opts) =>
          rows
            .filter(
              (m) =>
                opts.fPredicate(m) &&
                (!opts.fromMsg ||
                  +m.sendDttm < +opts.fromMsg.sendDttm ||
                  (+m.sendDttm === +opts.fromMsg.sendDttm &&
                    +m.msgId < +opts.fromMsg.msgId)),
            )
            .sort((a, b) => +b.sendDttm - +a.sendDttm || +b.msgId - +a.msgId)
            .slice(0, limit),
      },
    },
  };
  const req = {
    c: Object.fromEntries(
      Object.entries(modules).map(([k, exports]) => [k, { exports }]),
    ),
    m: {},
  };
  const chunks = [];
  chunks.push = function (chunk) {
    Array.prototype.push.call(this, chunk);
    Object.values(chunk[1])[0]({}, {}, req);
  };
  const context = vm.createContext({
    webpackJsonp: chunks,
    setTimeout,
    clearTimeout,
  });
  return vm.runInContext(
    "(" + searchInPage.toString() + ")",
    context,
  )({
    expectedId: "100",
    conversationId: "200",
    search: { query: "test", sender: "all", days: 0, ...search },
    ...scope,
  });
}
test("search validates scope, cursor and rejects extra command payload", () => {
  const search = { query: "test", sender: "all", days: 0 };
  const body = {
    owner: "a".repeat(64),
    action: "message-search",
    accountId: 1,
    conversationId: "200",
    search,
  };
  assert.equal(validCommand(body), true);
  for (const change of [
    { accountId: undefined },
    { conversationId: undefined },
    { text: "unexpected" },
    { search: { ...search, query: "" } },
    { search: { ...search, days: -1 } },
    { search: { ...search, before: { id: "x", time: "NaN" } } },
  ])
    assert.equal(!!validCommand({ ...body, ...change }), false);
  assert.equal(!!validMessageSearch({ ...search, owner: "foreign" }), false);
});
test("search refuses different identity and inaccessible conversation", async () => {
  await assert.rejects(run([], {}, { expectedId: "999" }), /IDENTITY_MISMATCH/);
  await assert.rejects(
    run([], {}, { conversationId: "999" }),
    /CONVERSATION_NOT_FOUND/,
  );
});
test("Vietnamese case/accent search, file names and recalled exclusion", async () => {
  const result = await run(
    [
      row(1, "Điện thoại"),
      row(2, { title: "ĐIỆN THOẠI.pdf" }, "300", now, 2),
      row(3, "điện thoại", "300", now, 9),
      { ...row(4, "điện thoại"), deleted: true },
      { ...row(5, "điện thoại"), deleting: true },
    ],
    { query: "dien thoai" },
  );
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].kind, "file");
  assert.equal(result.items[1].sender.name, "Bạn");
});
test("sender and dates filter independently before limiting", async () => {
  const rows = [
    row(1, "test", "0"),
    row(2, "test", "300"),
    row(3, "test", "300", now - 8 * 86400000),
  ];
  assert.equal((await run(rows, { sender: "me" })).items.length, 1);
  assert.equal((await run(rows, { sender: "300", days: 7 })).items.length, 1);
  assert.equal((await run(rows, { sender: "others" })).items.length, 2);
  assert.equal((await run(rows, { query: "absent" })).items.length, 0);
});
test("search pagination keeps all matches without duplicates at same timestamp", async () => {
  const rows = Array.from({ length: 76 }, (_, i) =>
    row(1000 + i, "test", "300", now),
  );
  const first = await run(rows);
  const next = await run(rows, { before: first.cursor });
  assert.equal(first.items.length, 50);
  assert.equal(next.items.length, 26);
  assert.equal(next.cursor, null);
  assert.equal(
    new Set([...first.items, ...next.items].map((m) => m.id)).size,
    76,
  );
});

test('sender/date-only search needs no keyword but empty unfiltered search is rejected', async()=>{
 assert.equal(!!validMessageSearch({query:'',sender:'me',days:0}),true);
 assert.equal(!!validMessageSearch({query:'',sender:'all',days:7}),true);
 assert.equal(!!validMessageSearch({query:'',sender:'all',days:0}),false);
 assert.equal((await run([row(1,'hello'),row(2,'other','300')],{query:'',sender:'me'})).items.length,1);
});
