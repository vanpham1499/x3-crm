import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { validCommand } from "./guards.mjs";
import { validMentions, displayMentions } from "./mentions.mjs";
import { SendReceipts } from "./send.mjs";
import { normalizeMessage } from "./messages.mjs";
const module = { exports: {} };
new Function(
  "exports",
  ts.transpileModule(
    await fs.readFile(
      new URL(
        "../../../../frontend/src/features/zalo-team/mentions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
)(module.exports);
const ui = module.exports;
const text = "😊 @Ánh chào bạn";
const mentions = [{ pos: 3, len: 4, uid: "123", type: 0 }];
const body = {
  action: "send-text",
  owner: "a".repeat(64),
  accountId: 1,
  conversationId: "g456",
  requestId: "12345678-1234-1234-1234-123456789abc",
  text,
  mentions,
};
test("viewer-specific contact names rebase mention and rich-text boundaries together", () => {
  const wire = "😊 @Nguyễn Thị Ánh chào";
  const tags = [{ pos: 3, len: 15, uid: "123", type: 0 }];
  const displayed = displayMentions(wire, tags, { 123: "Anh Nguyen" }, [
    { start: 19, len: 4, st: "b" },
  ]);
  assert.equal(displayed.text, "😊 @Anh Nguyen chào");
  assert.deepEqual(displayed.mentions, [
    { pos: 3, len: 11, uid: "123", type: 0 },
  ]);
  assert.deepEqual(displayed.styles, [{ start: 15, len: 4, st: "b" }]);
  const normalized = normalizeMessage({
    id: "1",
    type: "MSG_TEXT",
    message: {
      action: "rtf",
      title: wire,
      params: { styles: [{ start: 19, len: 4, st: "b" }] },
    },
    plainText: displayed.text,
    mentions: tags,
    mentionNames: { 123: "Anh Nguyen" },
  });
  assert.deepEqual(normalized.mentions, displayed.mentions);
  assert.deepEqual(normalized.styles, displayed.styles);
});
test("mention boundaries/UID/type are validated identically in browser and connector", () => {
  for (const check of [validMentions, ui.validMentions]) {
    assert.equal(check(mentions, text), true);
    for (const m of [
      null,
      [{ ...mentions[0], pos: 2 }],
      [{ ...mentions[0], len: 900 }],
      [{ ...mentions[0], uid: "url" }],
      [{ ...mentions[0], type: 1 }],
      [...mentions, ...mentions],
      [{ ...mentions[0], html: "x" }],
    ])
      assert.equal(check(m, text), false);
    assert.equal(
      check([{ pos: 0, len: 4, uid: "-1", type: 1 }], "@All hi"),
      true,
    );
  }
  assert.ok(validCommand(body));
  assert.equal(validCommand({ ...body, conversationId: "456" }), false);
  assert.equal(validCommand({ action: "mentions", owner: body.owner }), false);
});
test("edits preserve UTF16 offsets but invalidate a changed mention", () => {
  assert.equal(ui.mentionQuery("email@domain", 12, []), null);
  assert.equal(ui.mentionQuery("😊 @anh", 7, []).pos, 3);
  assert.equal(ui.mentionQuery(text, 6, mentions), null);
  assert.deepEqual(ui.editMentions(text, "xin " + text, mentions), [
    { ...mentions[0], pos: 7 },
  ]);
  assert.deepEqual(ui.editMentions(text, text + "!", mentions), mentions);
  assert.deepEqual(
    ui.editMentions(text, text.replace("Ánh", "Anh"), mentions),
    [],
  );
  assert.deepEqual(
    ui.editMentions(text, text.replace("@Ánh", ""), mentions),
    [],
  );
  const people = [
    { id: "1", name: "Nguyễn Thị Ánh", all: false },
    { id: "2", name: "Trần Hảo", all: false },
  ];
  assert.equal(ui.filterMembers(people, "anh nguyen", [])[0].id, "1");
  assert.equal(
    ui.filterMembers(people, "anh", [{ pos: 0, len: 2, uid: "1", type: 0 }])
      .length,
    0,
  );
});
test("outbox persists mention identity in idempotence and history keeps it", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zt-mentions-"));
  let sent = 0;
  try {
    const receipts = new SendReceipts(root, async (_page, args) => {
      assert.deepEqual(args.mentions, mentions);
      if (args.phase === "prepare") return { clientId: "99" };
      sent++;
      return { status: "sent", messageId: "100" };
    });
    await receipts.send({}, "1000", body);
    await receipts.send({}, "1000", body);
    assert.equal(sent, 1);
    await assert.rejects(
      receipts.send({}, "1000", {
        ...body,
        mentions: [{ ...mentions[0], uid: "456" }],
      }),
      /CONFLICT/,
    );
    assert.deepEqual(
      normalizeMessage({
        id: "100",
        type: "TEXT",
        message: text,
        plainText: text,
        mentions,
      }).mentions,
      mentions,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
