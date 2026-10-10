/* A project-only entrypoint around an unmodified, version-pinned Zalo PC bundle.
 * Public API returns only QR/state/account metadata. No general evaluate endpoint.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const Module = require('module');
const { withinProfile, validateIdentity, safeQr } = require('./guards.cjs');
const electron = require('electron');
const { app } = electron;
const local = path.resolve(__dirname, '../../../../tooling/zalo-team/.local');
const config = JSON.parse(fs.readFileSync(path.join(local, 'connector.json'), 'utf8'));
const vendor = path.join(config.install, 'resources/vendor.asar');
const expectedHash = '927aaaabaaac16fcb280c538f375cd822bc6deb81319c5d65a5c3e29e6abac09';
const profile = path.resolve(config.profile);
const within = value => withinProfile(profile,value);
if (!profile.startsWith(path.join(local, 'profiles') + path.sep) || !app.getPath('exe').startsWith(config.install + path.sep)) throw Error('PC_ISOLATION_INVALID');
const home = path.join(profile, 'home');
const paths = { home, appData: path.join(home,'AppData/Roaming'), userData: path.join(home,'AppData/Roaming/ZaloData'), sessionData: path.join(home,'AppData/Roaming/ZaloData'), temp: path.join(home,'AppData/Local/Temp') };
for (const name of ['documents','downloads','desktop','music','pictures','videos','logs','crashDumps']) paths[name] = path.join(home,name);
const setPath = app.setPath.bind(app);
for (const [name,value] of Object.entries(paths)) { fs.mkdirSync(value,{recursive:true}); setPath(name,value); }
process.env.APPDATA = paths.appData;
process.env.LOCALAPPDATA = path.join(home,'AppData/Local');
process.env.USERPROFILE = home;
process.env.TEMP = paths.temp;
process.env.TMP = paths.temp;
app.setPath = (name,value) => { if (!within(value)) throw Error('PC_PATH_OUTSIDE_PROFILE'); return setPath(name,value); };
app.getAppPath = () => vendor;
// The project runtime must not alter the user's default handlers or Windows startup.
app.setAsDefaultProtocolClient = () => false;
app.removeAsDefaultProtocolClient = () => false;
app.setLoginItemSettings = () => {};
app.setAppUserModelId = () => {};
app.relaunch = () => { restartRequested = true; };
app.setName('Zalo Team PC');

let registry, restartRequested = false, lastError = null;
const compile = Module.prototype._compile;
Module.prototype._compile = function(code, filename) {
  if (filename.replace(/\\/g,'/').endsWith('/vendor.asar/main-dist/main.js')) {
    Module.prototype._compile = compile;
    if (crypto.createHash('sha256').update(code).digest('hex') !== expectedHash) throw Error('PC_VERSION_UNSUPPORTED');
    const marker = 'r.m=e,r.c=t,';
    if (code.split(marker).length !== 2) throw Error('PC_ADAPTER_MISMATCH');
    globalThis.__zaloTeamCapture = r => { registry = r; };
    code = code.replace(marker, marker + 'globalThis.__zaloTeamCapture(r),');
  }
  return compile.call(this, code, filename);
};
// Do not log vendor messages or credentials. Keep a bounded code-only diagnostic.
function report(code) { if(code!=='PC_BOOTING')lastError = code; fs.writeFileSync(path.join(local,'runtime-status.json'),JSON.stringify({pid:process.pid,code,at:new Date().toISOString()})); }
process.on('uncaughtException', () => { report('PC_UNCAUGHT_ERROR'); app.exit(1); });
process.on('unhandledRejection', () => { report('PC_ASYNC_ERROR'); });
const bindingFile = path.join(profile,'account.json');
let binding = fs.existsSync(bindingFile) ? JSON.parse(fs.readFileSync(bindingFile,'utf8')) : null;
let login = null;
let queue = Promise.resolve();
function window() { return registry?.c?.qkcG?.exports.getMainWindow?.(); }
const probe = `(()=>{
  const frame=document.querySelector('.login-qr__frame-qr');
  if(frame){const img=frame.querySelector('img')?.getAttribute('src');return {state:frame.querySelector('.mask')?'expired':document.querySelector('[data-translate-inner="STR_LOGIN_QR_PAGE_AWAIT_ACCEPTED"]')?'confirming':'waiting_scan',qr:img||null};}
  if(!Array.isArray(globalThis.webpackJsonp))return {state:'connecting'};
  let r;const k='team-status-'+Date.now(),chunk=[[k],{[k]:(m,e,q)=>r=q},[[k]]];
  webpackJsonp.push(chunk);if(!r)return {state:'connecting'};
  delete r.c[k];delete r.m[k];const index=webpackJsonp.indexOf(chunk);if(index>=0)webpackJsonp.splice(index,1);
  const f=r.c.dThN?.exports.default,h=r.c.fdn9?.exports.a,u=r.c.DiYL?.exports.a;
  if(!f?.userId||h?.userId!==f.userId)return {state:'connecting'};
  const own=r.c.JWY6?.exports.a?._cacheProfileInfo?.[f.userId];
  const name=own?.displayName||own?.zaloName||own?.dName||u?.displayName;
  return {state:h.socket?._authenticated===true&&h.socket?.getSocketState?.()===1?'connected':'offline',externalId:String(f.userId),name:typeof name==='string'?name.slice(0,120):null};
})()`;
async function snapshot() {
  const w = window();
  let current = {state:'starting'};
  if (w && !w.isDestroyed() && !w.webContents.isLoading()) {
    let timer;
    try {current = await Promise.race([w.webContents.executeJavaScript(probe),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PC_STATUS_TIMEOUT')),5000);})]);}
    catch {current={state:'connecting'};}
    finally {clearTimeout(timer);}
    current=validateIdentity(current,binding);
    if (current.state === 'connected' && current.externalId && current.name) {
      binding = {id:1,externalId:current.externalId,name:current.name,color:'#b8c7e3',updatedAt:new Date().toISOString()};
      fs.writeFileSync(bindingFile+'.tmp',JSON.stringify(binding));fs.renameSync(bindingFile+'.tmp',bindingFile);
      await w.webContents.session.cookies.flushStore();
    }
  }
  if (login && Date.now() > login.expiresAt && !['connected','offline'].includes(current.state)) current = {state:'expired'};
  const qr = safeQr(current.qr);
  const profileIsolated=['home','appData','userData','sessionData','temp'].every(name=>within(app.getPath(name)));
  if(!profileIsolated)throw Error('PC_PATH_OUTSIDE_PROFILE');
  return {runtime:{available:true,version:'26.9.10',state:current.state,error:lastError,restartRequested,profileIsolated},
    accounts:binding?[{...binding,status:current.state==='connected'?'connected':current.state==='offline'?'offline':['waiting_scan','expired','confirming'].includes(current.state)?'expired':'connecting'}]:[],
    login:login?{id:login.id,state:current.state,expiresAt:login.expiresAt,qr:['waiting_scan','confirming'].includes(current.state)?qr:null}:null};
}
async function command(body) {
  if (!['status','begin','retry','cancel','stop'].includes(body.action)) throw Error('INVALID_ACTION');
  if (body.action === 'begin') {
    const now = await snapshot();
    if (now.accounts.some(a => a.status === 'connected')) throw Error('ONE_ACCOUNT_STAGE');
    if(!login || Date.now()>login.expiresAt) {
      login = {id:crypto.randomUUID(),expiresAt:Date.now()+120000};
      const w=window();if(w?.webContents.getURL().split('?')[0].endsWith('/login.html'))w.webContents.reload();
    }
  }
  if (['retry','cancel'].includes(body.action) && (!login || body.loginId !== login.id)) throw Error('LOGIN_REQUEST_CHANGED');
  if (body.action === 'retry') {
    const w=window();
    if(!w||!w.webContents.getURL().split('?')[0].endsWith('/login.html'))throw Error('LOGIN_NOT_READY');
    login={id:crypto.randomUUID(),expiresAt:Date.now()+120000};w.webContents.reload();
  }
  if (body.action === 'cancel') {
    const now=await snapshot();login=null;
    // Invalidate an unfinished QR by terminating only this isolated runtime.
    if(!now.accounts.some(a=>a.status==='connected')) setTimeout(()=>{registry?.('DfAL').appQuitFlow.quit();},100);
  }
  if(body.action==='stop') {
    login=null;
    const w=window();if(w&&!w.isDestroyed()){await w.webContents.session.cookies.flushStore();w.webContents.session.flushStorageData();}
    setTimeout(()=>{registry?.('DfAL').appQuitFlow.quit();},100);
    return {runtime:{available:false,state:'stopped'},accounts:binding?[{...binding,status:'offline'}]:[],login:null};
  }
  return snapshot();
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  if(req.headers.authorization!==`Bearer ${config.token}`||req.headers.origin){res.writeHead(403);return res.end('{}');}
  if(req.method!=='POST'||req.url!=='/command'){res.writeHead(404);return res.end('{}');}
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048){res.writeHead(413);return res.end('{}');}}
  try {
    const body=JSON.parse(raw);const result=queue.then(()=>command(body));queue=result.catch(()=>{});
    res.end(JSON.stringify(await result));
  } catch(error) {res.writeHead(409);res.end(JSON.stringify({error:/^[A-Z_]+$/.test(error.message)?error.message:'PC_OPERATION_FAILED'}));}
});
server.listen(config.port,'127.0.0.1',()=>report('PC_BOOTING'));
server.on('error',()=>app.exit(1));
app.on('browser-window-created',(_event,w)=>{
  w.setSkipTaskbar(true);
  w.on('show',()=>w.hide());
});
require(path.join(vendor,'bootstrap.js'));
