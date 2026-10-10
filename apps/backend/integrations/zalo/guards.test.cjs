const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {withinProfile,validateIdentity,safeQr}=require('./guards.cjs');
test('profile boundary rejects traversal and a sibling sharing the prefix',()=>{
  const root=path.resolve('isolated-profile');
  assert.equal(withinProfile(root,path.join(root,'data/session')),true);
  assert.equal(withinProfile(root,path.join(root,'../personal')),false);
  assert.equal(withinProfile(root,root+'-other/data'),false);
});
test('wrong identity cannot replace the linked account',()=>{
  assert.deepEqual(validateIdentity({state:'connected',externalId:'200',name:'Other'},{externalId:'100'}),{state:'identity_mismatch'});
});
test('connection requires both identity and resolved profile name',()=>{
  for(const value of [{state:'connected'},{state:'connected',externalId:'100'}, {state:'connected',externalId:'100',name:'  '}])assert.equal(validateIdentity(value,null).state,'connecting');
  assert.equal(validateIdentity({state:'connected',externalId:'100',name:'Test'},null).state,'connected');
});
test('a saved identity or offline session never becomes connected',()=>{
  assert.equal(validateIdentity({state:'offline',externalId:'100',name:'Test'},{externalId:'100'}).state,'offline');
  assert.equal(validateIdentity({state:'waiting_scan'},{externalId:'100'}).state,'waiting_scan');
});
test('QR projection only accepts bounded inline PNG',()=>{
  assert.equal(safeQr('https://example.test/qr'),null);
  assert.equal(safeQr('data:image/svg+xml;base64,PHN2Zz4='),null);
  assert.equal(safeQr('data:image/png;base64,'+'A'.repeat(250000)),null);
  assert.equal(safeQr('data:image/png;base64,YWJj'),'data:image/png;base64,YWJj');
});
