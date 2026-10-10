import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

let starting: Promise<void> | null = null;

export function canStartLocalGateway(url: URL) {
  return process.platform === 'win32' && process.env.ZALO_TEAM_RUNTIME !== 'crm' &&
    process.env.ZALO_TEAM_CALL_AUTOSTART !== 'false' && url.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '9260' &&
    !url.username && !url.password;
}

// Called only after CRM authentication, only for the configured local gateway.
// Preparing the worker does not open a microphone, signal Zalo or place a call.
export async function ensureLocalGateway(url: URL) {
  if (!canStartLocalGateway(url)) return;
  if (starting) return starting;
  starting = (async () => {
    const repo = path.resolve(process.cwd(), '../..');
    const script = path.join(repo, 'tooling/zalo-team/call/ensure-local.ps1');
    await fs.access(script);
    await new Promise<void>((resolve, reject) => {
      execFile(path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-NodePath', process.execPath],
        { cwd: repo, windowsHide: true, timeout: 22000, maxBuffer: 16000 },
        error => error ? reject(Error('CALL_START_FAILED')) : resolve());
    });
  })().finally(() => { starting = null; });
  return starting;
}
