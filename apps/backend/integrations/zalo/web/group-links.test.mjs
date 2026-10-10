import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {GroupLinks,validGroupLink} from './group-links.mjs';
import {validCommand} from './guards.mjs';
const owner='a'.repeat(64),other='b'.repeat(64);
const rows=['1:g1','3:g9','5:g7','1:g8','3:g8'].map(id=>({id,group:true}));
const load=async()=>({conversations:rows});
test('link contract rejects duplicate accounts, personal chats, unknown fields and client owner injection',()=>{
 assert.equal(validGroupLink({kind:'link',sources:['1:g1','3:g9']}),true);
 for(const sources of [['1:g1','1:g8'],['1:g1','3:9'],['1:g1']])assert.equal(validGroupLink({kind:'link',sources}),false);
 assert.equal(validCommand({action:'group-links',owner,link:{kind:'link',sources:['1:g1','3:g9']}}),true);
 assert.equal(validCommand({action:'group-links',owner,accountId:1,link:{kind:'link',sources:['1:g1','3:g9']}}),false);
});
test('links persist, isolate owners, filter hidden/offline sources and reject invisible targets',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'zt-links-'));try{
 const store=new GroupLinks(root);
 await assert.rejects(store.run(owner,{kind:'link',sources:['1:g1','2:g2']},load),/UNAVAILABLE/);
 const {groups:[g]}=await store.run(owner,{kind:'link',sources:['1:g1','3:g9']},load);
 const again=await new GroupLinks(root).project(owner,rows);assert.equal(again[0].id,g.id);
 assert.deepEqual(await store.project(other,rows),[]);
 assert.deepEqual((await store.project(owner,rows.filter(r=>r.id==='1:g1')))[0].sources,['1:g1']);
 assert.deepEqual(await store.project(owner,[]),[]);
 await store.run(owner,{kind:'remember',groupId:g.id,accountId:3},load);
 assert.equal((await store.project(owner,rows))[0].preferredAccountId,3);
 await assert.rejects(store.run(owner,{kind:'remember',groupId:g.id,accountId:5},load),/UNAVAILABLE/);
 await assert.rejects(store.run(other,{kind:'remember',groupId:g.id,accountId:3},load),/UNAVAILABLE/);
 await store.run(owner,{kind:'remember',groupId:g.id,accountId:null},load);
 assert.equal((await store.project(owner,rows))[0].preferredAccountId,null);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('repeat and concurrent links stay unique; conflicts fail; detaching never mutates native groups',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'zt-links-'));try{
 const store=new GroupLinks(root),link={kind:'link',sources:['1:g1','3:g9']};
 await Promise.all([store.run(owner,link,load),store.run(owner,link,load)]);
 assert.equal((await store.project(owner,rows)).length,1);
 await assert.rejects(store.run(owner,{kind:'link',sources:['1:g8','3:g9']},load),/CONFLICT/);
 const {groups:[g]}=await store.run(owner,{kind:'link',sources:['1:g1','5:g7']},load);
 assert.equal(g.sources.length,3);
 await store.run(owner,{kind:'link',sources:['1:g8','3:g8']},load);
 await assert.rejects(store.run(owner,{kind:'link',sources:['1:g1','3:g8']},load),/CONFLICT/);
 await store.run(owner,{kind:'unlink',groupId:g.id,source:'5:g7'},load);
 await store.run(owner,{kind:'unlink',groupId:g.id,source:'1:g1'},load);
 assert.equal((await store.project(owner,rows)).length,1);
 assert.equal(rows.length,5);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
