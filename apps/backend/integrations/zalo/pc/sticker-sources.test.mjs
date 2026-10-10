import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichPcStickers, pcStickerSources } from './sticker-sources.mjs';

test('missing optional sticker adapter preserves history, but account changes abort',async()=>{
 const snapshot={messages:[{msgId:'1',message:{catId:12,id:34}}]};
 const messages=[{id:'1',attachments:[{kind:'sticker'}]}];
 await enrichPcStickers({evaluate:async()=>{throw Error('PC_STICKER_ADAPTER_UNAVAILABLE');}},snapshot,{accountId:'42'},messages);
 assert.equal(messages[0].attachments[0].url,undefined);
 await assert.rejects(enrichPcStickers({evaluate:async()=>{throw Error('PC_ACCOUNT_CHANGED');}},snapshot,{accountId:'42'},messages),/ACCOUNT_CHANGED/);
});

test('PC sticker enrichment uses native category/id and caches resources without altering message identity',async()=>{
 const cache=new Map(), calls=[];
 const cdp={evaluate:async expression=>{calls.push(expression);return [{categoryId:12,stickerId:34,url:'https://stc-zalo.zdn.vn/sticker.png'}];}};
 const snapshot={messages:[{msgId:'1',message:{catId:12,id:34}},{msgId:'2',message:JSON.stringify({catId:12,id:34})}]};
 const messages=[1,2].map(id=>({id:String(id),kind:'media',attachments:[{kind:'sticker'}]}));
 await enrichPcStickers(cdp,snapshot,{accountId:'42'},messages,cache);
 assert.equal(calls.length,1);assert.equal(messages[0].attachments[0].url,messages[1].attachments[0].url);
 assert.equal(messages[0].kind,'media');assert.equal(messages[0].id,'1');
 await enrichPcStickers(cdp,snapshot,{accountId:'42'},messages,cache);assert.equal(calls.length,1);
});

test('native sticker resolver refuses wrong identity and never returns local file URLs',async()=>{
 const old=globalThis.webpackJsonp;
 const modules={dThN:{default:{userId:'42'}},fdn9:{a:{userId:'42'}},vSga:{default:{getStickerIfNotExist:async()=>({})}},Ullg:{a:{Helper:{getStickerThumbUrl:()=> 'file:///private/sticker'}}}};
 const req={c:Object.fromEntries(Object.entries(modules).map(([id,exports])=>[id,{exports}])),m:{}};
 globalThis.webpackJsonp=[];globalThis.webpackJsonp.push=chunk=>{Object.values(chunk[1])[0]({}, {},req);return Array.prototype.push.call(globalThis.webpackJsonp,chunk);};
 try{await assert.rejects(pcStickerSources({accountId:'43',references:[]}),/ACCOUNT_CHANGED/);
 assert.deepEqual(await pcStickerSources({accountId:'42',references:[{categoryId:1,stickerId:2}]}),[]);
 }finally{globalThis.webpackJsonp=old;}
});
