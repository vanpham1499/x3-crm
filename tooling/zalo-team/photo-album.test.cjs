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
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
    filename: file,
  })(
    (name) =>
      name.startsWith(".")
        ? load(path.resolve(path.dirname(file), name))
        : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const { groupPhotoMessages, photoAlbumLayout } = load(
  path.join(root, "photo-album.ts"),
);

test("photo albums retain native order and individual targets across page merges", () => {
  const photo = (id, index, group = "album", sender = "a") =>
    m(id, sender, Number(id), {
      text: "",
      kind: "media",
      photoGroup: { id: group, index, total: 11 },
      attachments: [
        {
          kind: "image",
          name: "",
          size: 0,
          width: 1200,
          height: 1600,
          url: `https://example.com/${id}.jpg`,
        },
      ],
    });
  const a = photo("1", 2),
    b = photo("2", 0),
    c = photo("3", 1);
  const grouped = groupPhotoMessages([a, b, c]);
  assert.equal(grouped.length, 1);
  assert.deepEqual(
    grouped[0].album.map((m) => m.id),
    ["2", "3", "1"],
  );
  assert.equal(grouped[0].time, c.time);
  assert.equal(groupPhotoMessages([a, photo("2", 0, "other"), c]).length, 3);
  assert.equal(groupPhotoMessages([a, photo("2", 0, "album", "b")]).length, 2);
  assert.equal(groupPhotoMessages([a, { ...b, text: "caption" }]).length, 2);
  assert.equal(
    groupPhotoMessages([a, { ...b, photoGroup: undefined }]).length,
    2,
  );
  assert.equal(groupPhotoMessages([a, b])[0].album.length, 2);
  const layout = photoAlbumLayout(Array(9).fill(a.attachments[0]));
  assert.equal(layout.positions.length, 9);
  for (const box of layout.positions) {
    assert.ok(box.width > 0 && box.height > 0);
    assert.ok(
      box.x + box.width <= layout.width && box.y + box.height <= layout.height,
    );
  }
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
