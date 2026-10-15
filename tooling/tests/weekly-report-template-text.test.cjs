const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const mod={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync('apps/frontend/src/features/weekly-reports/template-text.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
const {insertTemplateText}=mod.exports;
test('inserts ordered customer paragraphs without losing current notes',()=>{
  assert.equal(insertTemplateText('Ghi chú gốc',['Mẫu 1','Mẫu 2']).text,'Ghi chú gốc\n\nMẫu 1\n\nMẫu 2');
  assert.equal(insertTemplateText('TrướcSau',['Mẫu'],5).text,'Trước\n\nMẫu\n\nSau');
  assert.equal(insertTemplateText('Nội dung',['Mẫu'],0).text,'Mẫu\n\nNội dung');
});
test('handles empty templates, blank notes and paragraph boundaries',()=>{
  assert.equal(insertTemplateText('Gốc',['','  ']).text,'Gốc');
  assert.equal(insertTemplateText('',[' Mẫu ']).text,'Mẫu');
  assert.equal(insertTemplateText('Gốc\n\n',['Mẫu']).text,'Gốc\n\nMẫu');
  const result=insertTemplateText('AB',['Một'],1); assert.equal(result.text.slice(0,result.caret),'A\n\nMột');
});
