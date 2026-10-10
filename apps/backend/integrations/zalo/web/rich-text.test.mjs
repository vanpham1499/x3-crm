import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from 'typescript';
import { validCommand } from "./guards.mjs";
import { SendReceipts } from "./send.mjs";
import { normalizeMessage } from "./messages.mjs";
test('composer plain typing skips style matrix but retains pending and existing formatting', async () => {
  const exports = {};
  new Function('exports', ts.transpileModule(await fs.readFile(new URL('../../../../frontend/src/features/zalo-team/rich-text.ts', import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);
  const empty=[];
  assert.equal(exports.editStyles('Tiếng Việt','Tiếng Việt gõ nhanh',empty),empty);
  assert.deepEqual(exports.editStyles('','Đậm',empty,['b']),[{start:0,len:3,st:'b'}]);
  assert.deepEqual(exports.editStyles('Đậm','Đậm hơn',[{start:0,len:3,st:'b'}]),[{start:0,len:7,st:'b'}]);
  assert.deepEqual(exports.editStyles('Đậm','',[{start:0,len:3,st:'b'}]),[]);
});
const body = {
  action: "send-text",
  owner: "a".repeat(64),
  accountId: 1,
  conversationId: "123",
  requestId: "12345678-1234-1234-1234-123456789abc",
  text: "Chữ đậm 😊\nDanh sách",
  styles: [
    { start: 0, len: 7, st: "b,c_db342e" },
    { start: 11, len: 9, st: "lst_1,ind_1" },
  ],
};
body.styles[1].len = body.text.length - 11;
test("RTF ranges validate native UTF16 offsets and disallow arbitrary style/HTML", () => {
  assert.ok(validCommand(body));
  for (const styles of [
    null,
    [{ start: -1, len: 1, st: "b" }],
    [{ start: 0, len: 3000, st: "b" }],
    [{ start: 0, len: 1, st: "background:url(x)" }],
    [{ start: 0, len: 1, st: "c_red" }],
    [{ start: 0, len: 1, st: "f_200" }],
    [{ start: 0, len: 1, st: "b", html: "x" }],
  ])
    assert.equal(validCommand({ ...body, styles }), false);
  assert.equal(
    validCommand({
      ...body,
      action: "send-sticker",
      text: undefined,
      sticker: { id: 1, categoryId: 0 },
    }),
    false,
  );
});
test("rich send preserves formatting, durable receipts bind styles, quick Like is native text", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zt-rtf-"));
  let sends = 0;
  const adapter = async (_page, args) => {
    assert.deepEqual(args.styles, body.styles);
    if (args.phase === "prepare") return { clientId: "123" };
    sends++;
    return { status: "sent", messageId: "456" };
  };
  try {
    const receipts = new SendReceipts(root, adapter);
    await receipts.send({}, "100", body);
    await receipts.send({}, "100", body);
    assert.equal(sends, 1);
    await assert.rejects(
      receipts.send({}, "100", {
        ...body,
        styles: [{ start: 0, len: 2, st: "i" }],
      }),
      /CONFLICT/,
    );
    assert.ok(validCommand({ ...body, text: "/-strong", styles: undefined }));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("history roundtrip keeps RTF styles and text; malformed style cannot reach renderer", () => {
  const raw = {
    id: "1",
    clientId: "2",
    time: 1,
    type: "MSG_TEXT",
    message: {
      action: "rtf",
      title: body.text,
      params: JSON.stringify({ styles: body.styles, ver: 1 }),
    },
  };
  const normalized = normalizeMessage(raw);
  assert.equal(normalized.text, body.text);
  assert.deepEqual(normalized.styles, body.styles);
  raw.message.params = JSON.stringify({
    styles: [{ start: 0, len: 1, st: "c_url(x)" }],
  });
  assert.equal(normalizeMessage(raw).styles, undefined);
});
import vm from "node:vm";
import { nativeText } from "./send.mjs";
test("native adapter passes styles into transport options, including encrypted send", async () => {
  const sent = [];
  class Message {
    updateMessageContentProp(key, value) {
      this[key] = value;
    }
    updateMessageFormat(text, styles) {
      this.rtf = { text, styles };
    }
    getAdditionalParams() {
      return { styles: this.rtf.styles };
    }
  }
  const modules = {
    dThN: {
      default: {
        userId: "100",
        sendMsgObject: async (...args) => {
          sent.push(args);
          return { msgId: "456" };
        },
      },
    },
    jDHv: { ModuleContainer: { resolve: () => ({ getList: () => ["123"] }) } },
    iZzu: { ConvListController: "list" },
    "3xbP": { c: "all" },
    "4HQc": { c: Message, a: { TEXT: "text" } },
    "1pet": { MSG_TEXT: 1, RETRY_MSG_TIMEOUT_DEFAULT: 30000 },
    NMlV: { a: { next: () => 123 } },
    GpwQ: {
      a: {
        instance: () => ({
          isOnE2ee: () => true,
          sendMessageE2ee: (_conv, _id, send) => send(),
        }),
      },
    },
    NDmK: { default: { limitSendTextPerTurn: 2000 } },
  };
  const require = {
    c: Object.fromEntries(
      Object.entries(modules).map(([k, v]) => [k, { exports: v }]),
    ),
    m: {},
  };
  const chunks = [];
  chunks.push = function (chunk) {
    Array.prototype.push.call(this, chunk);
    Object.values(chunk[1])[0]({}, {}, require);
  };
  const context = vm.createContext({
    webpackJsonp: chunks,
    crypto: { randomUUID: () => "fixture" },
    setTimeout,
    clearTimeout,
  });
  const page = {
    frames: () => [
      {
        url: () => "https://chat.zalo.me/",
        evaluate: (fn, args) => {
          context.args = args;
          return vm.runInContext(`(${fn.toString()})(args)`, context);
        },
      },
    ],
  };
  const result = await nativeText(page, {
    expectedId: "100",
    conversationId: "123",
    text: body.text,
    styles: body.styles,
    phase: "send",
    clientId: "123",
  });
  assert.equal(result.status, "sent");
  assert.deepEqual(sent[0][5].styles, body.styles);
  assert.equal(sent[0][0].rtf.text, body.text);
});
