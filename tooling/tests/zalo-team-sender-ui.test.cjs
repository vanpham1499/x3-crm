const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve('apps/frontend/src/features/zalo-team');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, Date, Intl, console, require: name => {
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (name === './message-content') return { MessageText: ({ text }) => React.createElement('span', null, text), MessageAttachmentView: () => null };
    if (['./message-actions', './avatar', './icon', './poll-card', './topic-event'].includes(name)) return new Proxy({}, { get: () => () => null });
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  } }, { filename: file });
  cache.set(file, module.exports); return module.exports;
}
const { MessageItem } = load(path.join(root, 'components/message-item.tsx'));
const { sameMessageBlock } = load(path.join(root, 'message-presentation.ts'));
const { mergeTimelineMessages } = load(path.join(root, 'timeline-merge.ts'));
const base = { id: '456', clientId: '123', time: 1780000000000, kind: 'text', type: 'MSG_TEXT', mine: true,
  sender: { name: 'Zalo account' }, text: 'Nội dung', attachments: [], quote: null };
const sender = { userId: 42, name: 'Nguyễn Duy Anh' };
const render = message => renderToStaticMarkup(React.createElement(MessageItem, {
  message, conversation: { accountId: 5, conversationId: '42', group: false }, first: true, last: true, onPreview: () => {},
}));
test('Team sender shares the time line; native app messages only show time', () => {
  assert.doesNotMatch(render(base), /crmMessageSender|Gửi bởi/);
  const html = render({ ...base, crmSender: sender });
  assert.match(html, /<time[^>]*>\d{2}:\d{2} - Nguyễn Duy Anh<\/time>/);
  assert.doesNotMatch(html, /crmMessageSender|Gửi bởi/);
  for (const patch of [{ archived: true }, { kind: 'call', call: { direction: 'outgoing', durationSeconds: 6, video: false, missed: false, callback: true, reason: 0 } }, { kind: 'file', attachments: [{ kind: 'file', name: 'f.pdf' }] }, { kind: 'sticker', text: '', attachments: [{ kind: 'sticker' }] }])
    assert.match(render({ ...base, ...patch, crmSender: sender }), /<time[^>]*>\d{2}:\d{2} - Nguyễn Duy Anh<\/time>/);
  assert.match(render({ ...base, crmSender: { ...sender, name: '<script>test</script>' } }), /&lt;script&gt;/);
});
test('different CRM users and unlabelled app messages cannot merge into one sender block', () => {
  const a = { ...base, crmSender: sender };
  assert.equal(sameMessageBlock(a, { ...a, time: a.time + 100 }), true);
  assert.equal(sameMessageBlock(a, { ...a, crmSender: { userId: 43, name: sender.name } }), false);
  assert.equal(sameMessageBlock(a, base), false);
});
test('archive and live responses keep sender in either arrival order, without matching another message', () => {
  const stored = { ...base, archived: true, crmSender: sender };
  assert.equal(mergeTimelineMessages([stored], [base])[0].crmSender.userId, 42);
  assert.equal(mergeTimelineMessages([base], [stored])[0].crmSender.userId, 42);
  assert.equal(mergeTimelineMessages([stored], [{ ...base, clientId: 'other' }])[0].crmSender, undefined);
});

// Optional local-only visual fixture using the production message component/CSS.
if (process.env.ZALO_SENDER_PREVIEW === '1') {
  const css = fs.readFileSync(path.join(root, 'zalo-team.module.css'), 'utf8');
  const rows = [
    render({ ...base, text: 'Tin gửi trực tiếp từ ứng dụng Zalo.' }),
    render({ ...base, text: 'Em đã gửi báo giá cho khách rồi nhé.', crmSender: sender }),
    render({ ...base, text: 'Mình sẽ theo dõi phản hồi của khách.', crmSender: { userId: 43, name: 'Trần Thị Mai' } }),
  ].join('');
  fs.mkdirSync('.local/sender-preview', { recursive: true });
  fs.writeFileSync('.local/sender-preview/index.html', `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Mẫu nhãn người gửi Zalo Team</title><style>${css}</style><style>body{margin:0;font:14px 'Segoe UI',sans-serif;color:#081b3a;background:#eaebef}header{background:white;padding:20px 28px;border-bottom:1px solid #d6dbe1}main{--secondary:#5a6981;max-width:740px;margin:24px auto;padding:16px}.messageRow{margin-bottom:20px!important}</style><header><b>Nhãn người gửi Zalo Team</b><div style="margin-top:6px;color:#5a6981;font-size:12px">Mẫu kiểm tra giao diện — không gửi tin thật</div></header><main>${rows}</main></html>`);
}
