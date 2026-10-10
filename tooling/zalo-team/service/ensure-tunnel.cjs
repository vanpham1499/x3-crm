const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function localVpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && ['9340','9345'].includes(url.port);
  } catch { return false; }
}
function readSetting(file, key) {
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(line => line.startsWith(key + '='));
  return line?.slice(key.length + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
}
function needsTunnel(repo, env = process.env) {
  // Never start a VPS connection for Linux, an unconfigured checkout, or another endpoint.
  const frontend = env.ZALO_TEAM_API_URL ?? readSetting(path.join(repo, 'apps/frontend/.env.local'), 'ZALO_TEAM_API_URL') ?? readSetting(path.join(repo, 'apps/frontend/.env'), 'ZALO_TEAM_API_URL');
  const backend = env.ZALO_TEAM_REMOTE_API_URL ?? readSetting(path.join(repo, 'apps/backend/.env'), 'ZALO_TEAM_REMOTE_API_URL');
  return localVpsUrl(frontend) || localVpsUrl(backend);
}
function main() {
  const repo = path.resolve(__dirname, '../../..');
  if (process.platform !== 'win32' || !needsTunnel(repo)) return;
  const result = spawnSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'ensure-tunnel.ps1')],
    { cwd: repo, stdio: 'inherit', windowsHide: true, timeout: 45000 });
  if (result.error || result.status !== 0)
    console.warn('[Zalo Team] Could not confirm the VPS connection. Run npm run dev:zalo-vps to reconnect. CRM can still start.');
}
if (require.main === module) main();
module.exports = { localVpsUrl, needsTunnel };
