const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(
  __dirname,
  "../../apps/frontend/src/features/zalo-team",
);
const cache = new Map();
function load(file) {
  if (file.endsWith('use-account-access')) return {useAccountAccess:()=>({admin:true,accounts:{}})};
  if (file.endsWith(".css"))
    return new Proxy(
      {},
      { get: (_, key) => (key === "__esModule" ? false : String(key)) },
    );
  file = path.extname(file)
    ? file
    : [".ts", ".tsx"].map((ext) => file + ext).find(fs.existsSync);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText.replaceAll('import.meta.url', JSON.stringify(require('node:url').pathToFileURL(file).href));
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
    filename: file,
  })(
    (name) =>
      name.startsWith('@/') ? load(path.resolve(root, '../..', name.slice(2))) : name.startsWith(".")
        ? load(path.resolve(path.dirname(file), name))
        : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const { sameMessageBlock, messageLayout, fileSize } = load(
  path.join(root, "message-presentation.ts"),
);
const { MessageItem } = load(path.join(root, "components/message-item.tsx"));
const { captureMessageAnchor, restoreMessageAnchor, historyCursorAdvanced } =
  load(path.join(root, "message-scroll.ts"));

test("history cursor must advance, preserving large message IDs as strings", () => {
  const before = { id: "90071992547409930", time: "1000" };
  assert.equal(historyCursorAdvanced(before, before), false);
  assert.equal(
    historyCursorAdvanced(before, { ...before, time: "1001" }),
    false,
  );
  assert.equal(historyCursorAdvanced(before, { ...before, time: "999" }), true);
  assert.equal(
    historyCursorAdvanced(before, { id: "90071992547409929", time: "1000" }),
    true,
  );
  assert.equal(historyCursorAdvanced(before, null), true);
});

test("reading anchor survives prepends, delayed media and text reflow without pinning the user", () => {
  let scrollTop = 300;
  const heights = [280, 90, 140];
  const rows = heights.map((_, index) => ({
    dataset: { messageId: `id-${index}` },
    getBoundingClientRect: () => {
      const top =
        100 + heights.slice(0, index).reduce((a, b) => a + b, 0) - scrollTop;
      return { top, bottom: top + heights[index] };
    },
  }));
  const viewport = {
    get scrollTop() {
      return scrollTop;
    },
    set scrollTop(value) {
      scrollTop = value;
    },
    getBoundingClientRect: () => ({ top: 100 }),
    querySelectorAll: () => rows,
  };
  const anchor = captureMessageAnchor(viewport);
  assert.deepEqual(anchor, { id: "id-1", offset: -20 });
  heights[0] += 700; // Prepending content and changing block/date separators.
  restoreMessageAnchor(viewport, anchor);
  assert.equal(scrollTop, 1000);
  heights[0] += 180; // Image resolves above the visible message.
  restoreMessageAnchor(viewport, anchor);
  assert.equal(scrollTop, 1180);
  assert.deepEqual(captureMessageAnchor(viewport), anchor);
  scrollTop -= 150; // User deliberately scrolls, producing a fresh anchor.
  const nextAnchor = captureMessageAnchor(viewport);
  restoreMessageAnchor(viewport, nextAnchor);
  assert.equal(scrollTop, 1030);
  restoreMessageAnchor(viewport, { id: 'missing"id', offset: 0 });
  assert.equal(scrollTop, 1030);
});
const m = (id, sender, delta = 0, extra = {}) => ({
  id,
  clientId: id,
  time: Date.UTC(2026, 8, 30, 10) + delta,
  type: "MSG_TEXT",
  kind: "text",
  mine: false,
  sender: { id: sender, name: "Same name" },
  text: "Message",
  attachments: [],
  quote: null,
  ...extra,
});
const conversation = { id: "1:g42", accountId: 1, name: "Group", group: true, color: "#eee" };
const render = (message, first = true, last = true) =>
  renderToStaticMarkup(
    React.createElement(MessageItem, {
      message,
      conversation,
      first,
      last,
      onPreview: () => {},
    }),
  );

test('archived messages expose copy menu without unsupported native mutation controls', () => {
  const html = renderToStaticMarkup(React.createElement(MessageItem, {
    message: m('stored-1', 'a', 0, {archived:true}), conversation, first:true, last:true,
    onPreview:()=>{}, onReply:()=>{}, onAction:async()=>{},
  }));
  assert.ok(html.includes('Thêm thao tác tin nhắn'));
  assert.ok(!html.includes('aria-label="Trả lời"'));
  assert.ok(!html.includes('aria-label="Thả cảm xúc"'));
});

test("photo caption follows its image and the group sender stays outside the photo card", () => {
  const html = render(
    m("photo-caption", "a", 0, {
      text: "Caption below image",
      attachments: [
        {
          kind: "image",
          name: "Photo",
          url: "https://example.com/photo.jpg",
          size: 0,
        },
      ],
    }),
  );
  assert.ok(html.indexOf("photo.jpg") < html.indexOf("Caption below image"));
  assert.ok(html.indexOf("Same name") < html.indexOf("photoCaptionBubble"));
  assert.equal((html.match(/Caption below image/g) || []).length, 1);
});

test("blocks use sender IDs, direction, local date and native 30-minute boundary", () => {
  assert.equal(sameMessageBlock(m("1", "a"), m("2", "b")), false);
  assert.equal(sameMessageBlock(m("1", "a"), m("2", "a", 1800000)), true);
  assert.equal(sameMessageBlock(m("1", "a"), m("2", "a", 1800001)), false);
  assert.equal(sameMessageBlock(m("1", ""), m("2", "")), false);
  assert.equal(
    sameMessageBlock(m("1", "a"), m("2", "a", 0, { mine: true })),
    false,
  );
  const beforeMidnight = m("1", "a", 0, {
    time: Date.UTC(2026, 8, 30, 16, 59),
  });
  const afterMidnight = m("2", "a", 0, { time: Date.UTC(2026, 8, 30, 17, 1) });
  assert.equal(sameMessageBlock(beforeMidnight, afterMidnight), false);
  assert.equal(
    messageLayout([beforeMidnight, afterMidnight], 1).separator,
    "1/10/2026",
  );
});
test("history prepend recomputes first/last without duplicating avatar, name or time", () => {
  const a = m("1", "a"),
    b = m("2", "a", 1000),
    c = m("3", "a", 2000);
  assert.equal(messageLayout([b, c], 0).first, true);
  assert.equal(messageLayout([a, b, c], 1).first, false);
  assert.equal(messageLayout([a, b, c], 1).last, false);
  const middle = render(b, false, false);
  assert.ok(!middle.includes("messageSender"));
  assert.ok(!middle.includes("<time"));
  assert.ok(!middle.includes("Same name"));
  assert.ok(render(c, false, true).includes("<time"));
});
test("media and files have distinct layout; quotes and content remain escaped", () => {
  const photo = render(
    m("1", "a", 0, {
      kind: "media",
      text: "",
      attachments: [
        {
          kind: "image",
          name: "Photo",
          size: 0,
          url: "https://example.com/a.jpg",
        },
      ],
    }),
  );
  assert.ok(photo.includes("floatingBubble"));
  assert.ok(photo.includes("floatingTime"));
  const file = render(
    m("2", "a", 0, {
      kind: "media",
      text: "",
      attachments: [
        {
          kind: "file",
          name: "report.xlsx",
          size: 2048,
          url: "https://example.com/file",
        },
      ],
    }),
  );
  assert.ok(
    file.includes("fileCard") && file.includes('data-file-type="xlsx"') && file.includes('icon-excel.svg'),
  );
  assert.ok(file.includes("2 KB"));
  assert.ok(
    !render(
      m("3", "a", 0, {
        text: "<script>alert(1)</script>",
        quote: { sender: "<img>", text: "quoted" },
      }),
    ).includes("<script>"),
  );
  const expired = render(
    m("4", "a", 0, {
      text: "",
      attachments: [{ kind: "image", name: "Photo", size: 0 }],
    }),
  );
  assert.ok(expired.includes("Không tải được từ Zalo"));
  assert.equal(fileSize(Infinity), "");
});
test("emoji rendering preserves selectable fallback and does not inject native HTML", () => {
  const html = render(
    m("1", "a", 0, {
      text: "Hi :)",
      inline: [
        { text: "Hi " },
        {
          text: ":)",
          sprite: "https://res-zalo.zadn.vn/emoji.png",
          position: "2% 4%",
        },
      ],
    }),
  );
  assert.ok(html.includes("messageEmoji") && html.includes('aria-label=":)"'));
  assert.ok(!html.includes("emojiOnly"));
});
