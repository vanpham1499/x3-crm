const { spawnSync } = require('node:child_process');
const path = require('node:path');
const [root, id] = process.argv.slice(2);
if (process.platform !== 'win32' || !path.isAbsolute(root || '') || !/^[a-f0-9-]{36}$/.test(id || '')) process.exit(1);
// Only the requested file dialog is visible. No terminal; no file bytes are copied.
const result = spawnSync('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass',
  '-WindowStyle', 'Hidden', '-File', path.join(__dirname, 'pick-file.ps1'),
  '-ResultPath', path.join(root, 'picker-result.json'), '-RequestId', id],
  { windowsHide: true, stdio: 'ignore', timeout: 20000 });
if (result.error || result.status !== 0) process.exit(1);
