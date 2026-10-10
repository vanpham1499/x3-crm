const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function readSetting(file, key) {
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(line => line.startsWith(key + '='));
  return line?.slice(key.length + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
}
function shouldStart(repo, env = process.env, platform = process.platform) {
  const setting = key => env[key] ?? readSetting(path.join(repo, 'apps/frontend/.env.local'), key) ?? readSetting(path.join(repo, 'apps/frontend/.env'), key);
  if (platform !== 'win32' || setting('ZALO_TEAM_RUNTIME') === 'crm' || setting('ZALO_TEAM_CALL_AUTOSTART') === 'false') return false;
  try {
    const url = new URL(setting('ZALO_TEAM_CALL_URL') || 'http://127.0.0.1:9260');
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '9260' && !url.username && !url.password;
  } catch { return false; }
}
function main() {
  const repo = path.resolve(__dirname, '../../..');
  if (!shouldStart(repo)) return;
  // Only use the existing configured connector; do not provision credentials here.
  if (!fs.existsSync(path.join(repo, 'tooling/zalo-team/.local/web-token'))) return;
  const result = spawnSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'ensure-local.ps1'), '-NodePath', process.execPath],
    { cwd: repo, windowsHide: true, timeout: 22000, stdio: 'pipe' });
  console.log(result.status === 0 ? '[Zalo Team] Call gateway ready.' : '[Zalo Team] Call gateway not ready. Check .local/zalo-call-assets/gateway-local.stderr.log.');
}
if (require.main === module) main();
module.exports = { shouldStart };
