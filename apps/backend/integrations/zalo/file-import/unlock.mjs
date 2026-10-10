import fs from "node:fs";
import { createHash } from "node:crypto";
import { listTargets, CdpConnection } from "../shared/cdp.mjs";
import { inspectInstallation } from "../shared/asar.mjs";
import { ExportReader } from "./format.mjs";
const conf = JSON.parse(fs.readFileSync(0, "utf8"));
inspectInstallation(conf.install);
let result;
for (let tries = 0; tries < 60; tries++) {
  let cdp;
  try {
    const targets = (await listTargets("http://127.0.0.1:9333")).filter(
      (t) =>
        t.url.startsWith("file:///") &&
        decodeURI(t.url)
          .replaceAll("\\", "/")
          .toLowerCase()
          .includes(
            conf.install.replaceAll("\\", "/").toLowerCase() +
              "/resources/app.asar/pc-dist/",
          ) &&
        /\/(index|main)\.html/.test(t.url),
    );
    if (targets.length !== 1) throw Error("NOT_READY");
    cdp = await new CdpConnection(targets[0].webSocketDebuggerUrl).connect();
    result = await cdp.evaluate(
      `(()=>{let r;const id='team-file-unlock-'+Date.now(),chunk=[[id],{[id]:(m,e,q)=>{r=q;}},[[id]]];if(!Array.isArray(globalThis.webpackJsonp))return null;try{webpackJsonp.push(chunk);}finally{if(r){delete r.c[id];delete r.m[id];}const i=webpackJsonp.indexOf(chunk);if(i>=0)webpackJsonp.splice(i,1);}const s=r?.c.dThN?.exports.default;const uid=String(s?.userId||'');if(!uid||!s?.UIN)return null;if(uid!==${JSON.stringify(conf.accountId)})return {mismatch:true};return {uin:s.UIN,constants:Object.entries(r?.c['1pet']?.exports||{}).filter(([n,v])=>/^MSG_/.test(n)&&typeof v==='number')};})()`,
    );
    if (result?.mismatch) throw Error("FILE_ACCOUNT_MISMATCH");
    if (result?.uin) break;
  } catch (e) {
    if (e.message === "FILE_ACCOUNT_MISMATCH") throw e;
  } finally {
    cdp?.close();
  }
  await new Promise((r) => setTimeout(r, 1000));
}
if (!result?.uin) throw Error("FILE_KEY_UNAVAILABLE");
const key = createHash("sha256").update(result.uin).digest();
const iv = Buffer.from("zie" + result.uin.slice(0, 13));
result.uin = "";
const secret = {
  key: key.toString("base64"),
  iv: iv.toString("base64"),
  constants: result.constants,
};
try {
  const r = new ExportReader(conf.source, secret, conf.accountId);
  r.close();
  process.stdout.write(JSON.stringify(secret));
} finally {
  key.fill(0);
  iv.fill(0);
}
