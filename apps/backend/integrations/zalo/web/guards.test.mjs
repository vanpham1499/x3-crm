import { test } from "node:test";
import assert from "node:assert/strict";
import { validCommand, authorized, validateIdentity } from "./guards.mjs";

test('campaign media dispatch and receipt checks must omit text, including empty text', () => {
  const body={owner:'a'.repeat(64),action:'send-media',accountId:7,conversationId:'123',requestId:'12345678-1234-4234-8234-123456789012',expectedExternalId:'777',crmSender:{userId:1,name:'Tester'},media:{uploadId:'23456789-1234-4234-8234-123456789012'}};
  for (const command of [body,{...body,checkOnly:true}]) {
    assert.ok(validCommand(command));
    assert.equal(validCommand({...command,text:''}),false);
  }
});

test('campaign reconciliation fields are limited to send operations', () => {
  const body={owner:'a'.repeat(64),action:'send-text',accountId:1,conversationId:'9',text:'test',requestId:'12345678-1234-4234-8234-123456789012',checkOnly:true,expectedExternalId:'123'};
  assert.ok(validCommand(body));
  assert.ok(!validCommand({...body,checkOnly:false}));
  assert.ok(!validCommand({...body,expectedExternalId:'../123'}));
  assert.ok(!validCommand({...body,action:'status'}));
});

test("history accepts native dotted cursor IDs, rejects arbitrary input", () => {
  const base = { owner: "a".repeat(64), action: "messages", accountId: 1, conversationId: "g123", before: {id: "123456789012345.123", time: "1789747200000"} };
  assert.ok(validCommand(base));
  assert.ok(validCommand({...base,before:{...base.before,id:"topic:123:created"}}));
  for (const id of ["../escape", "bad id", "x".repeat(201), "<script>"]) assert.ok(!validCommand({...base,before:{...base.before,id}}));
});
test("reject commands and arbitrary browser inputs", () => {
  const base = { owner: "a".repeat(64), action: "begin" };
  assert.ok(validCommand(base));
  for (const change of [
    { action: "evaluate" },
    { url: "https://example.com" },
    { owner: "../profile" },
    { loginId: 23 },
    { accountId: "../profile" },
    { accountId: -1 },
    { accountId: 1.5 },
  ])
    assert.ok(!validCommand({ ...base, ...change }));
  assert.ok(!validCommand({ ...base, action: "stop" }));
  assert.ok(validCommand({ ...base, action: "stop", accountId: 2 }));
});
test("private connector requires matching bearer", () => {
  assert.ok(authorized("Bearer abc", "abc"));
  assert.ok(!authorized("Bearer abcd", "abc"));
  assert.ok(!authorized(undefined, "abc"));
});
test("saved or mismatched identity does not establish connection", () => {
  assert.equal(
    validateIdentity(
      { state: "connected", externalId: "1", name: "A" },
      { externalId: "2" },
    ).state,
    "identity_mismatch",
  );
  assert.equal(
    validateIdentity({ state: "connected", externalId: "1", name: "" }, null)
      .state,
    "connecting",
  );
  assert.equal(
    validateIdentity({ state: "offline", externalId: "1", name: "A" }, null)
      .state,
    "offline",
  );
});
