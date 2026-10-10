import fs from 'node:fs/promises';

// Server-only addresses and keys; none of these values use NEXT_PUBLIC_*.
export async function zaloBackend() {
  if (process.env.ZALO_TEAM_RUNTIME === 'crm') throw Error('ZALO_SERVICE_ROUTING_REQUIRED');
  const dedicated = process.env.ZALO_TEAM_API_URL;
  if (process.env.ZALO_TEAM_RUNTIME === 'zalo' && !dedicated)
    throw Error('ZALO_BACKEND_NOT_CONFIGURED');
  const url = (dedicated || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
  const headers: Record<string, string> = {};
  if (dedicated) {
    const key = (await fs.readFile(process.env.ZALO_TEAM_SERVICE_KEY_FILE || '', 'utf8')).trim();
    if (!/^[a-f0-9]{64}$/.test(key)) throw Error('ZALO_SERVICE_KEY_NOT_CONFIGURED');
    headers['X-Zalo-Service-Key'] = key;
  }
  return { url, headers };
}
