const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const context = { exports: {}, require: () => ({}) };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      "apps/frontend/src/features/zalo-team/group-links.ts",
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  context,
);
const { groupRows } = context.exports;
const row = (accountId, conversationId, globalGroupId, extra = {}) => ({
  id: `${accountId}:${conversationId}`,
  accountId,
  conversationId,
  globalGroupId,
  group: true,
  name: "Same name",
  preview: "Bạn: Hello",
  accountName: `Account ${accountId}`,
  updatedAt: accountId,
  ...extra,
});
test("different account IDs automatically share one row only for the same global identity", () => {
  const sources = [
    row(5, "g121", "999"),
    row(13, "g807", "999"),
    row(7, "g44", "888"),
  ];
  const result = groupRows(sources, [], { "auto:999": 5 });
  assert.equal(result.length, 2);
  const group = result.find((r) => r.link);
  assert.equal(group.sources.length, 2);
  assert.equal(group.link.automatic, true);
  assert.equal(group.link.preferredAccountId, 5);
  assert.equal(group.conversation.preview, "Account 13: Hello");
  assert.equal(group.sources[0].id, "5:g121"); // Sending still uses the native source.
  assert.equal(sources[0].preview, "Bạn: Hello");
});
test("same names/local IDs, personal chats, missing IDs and ambiguous account mappings stay separate", () => {
  for (const sources of [
    [row(5, "g1"), row(13, "g1")],
    [row(5, "g1", "1"), row(13, "g1", "2")],
    [row(5, "1", "1", { group: false }), row(13, "2", "1", { group: false })],
    [row(5, "g1", "1"), row(5, "g2", "1"), row(13, "g3", "1")],
    [row(5, "g1", "0"), row(13, "g2", "0")],
  ])
    assert.equal(groupRows(sources, []).length, sources.length);
});
test("manual links retain precedence and automatic groups cannot pull invisible/archived sources back", () => {
  const sources = [row(5, "g1", "1"), row(13, "g2", "1"), row(7, "g3", "2")];
  const manual = {
    id: "manual",
    sources: ["5:g1", "7:g3"],
    preferredAccountId: 7,
  };
  const result = groupRows(sources, [manual]);
  assert.equal(result.length, 2);
  assert.equal(result.find((r) => r.link)?.link.id, "manual");
  const filtered = groupRows(
    sources.filter((r) => r.accountId === 13),
    [],
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].sources.length, 1);
  assert.equal(filtered[0].sources[0].accountId, 13);
});
test("incremental account arrival, removal, name changes and unread flags preserve grouping", () => {
  const a = row(5, "g1", "1", { unread: 3 }),
    b = row(13, "g2", "1", { name: "Renamed", pinned: true });
  assert.equal(groupRows([a], []).length, 1);
  const together = groupRows([b, a], [])[0];
  assert.equal(together.link.id, "auto:1");
  assert.equal(together.conversation.unreadMarked, true);
  assert.equal(together.conversation.pinned, true);
  assert.equal(groupRows([a, b], [])[0].link.id, together.link.id);
  assert.equal(groupRows([b], [])[0].sources.length, 1);
});
