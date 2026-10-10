import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AccountAccess } from '@/features/zalo-team/account-access';

const pendingAccess = new Map<string, Promise<AccountAccess>>();

export async function authenticatedAccess(request: Request): Promise<AccountAccess> {
  if (process.env.ZALO_TEAM_RUNTIME === 'crm') throw Error('ZALO_SERVICE_ROUTING_REQUIRED');
  const origin = request.headers.get('origin');
  if (origin !== (process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin))
    throw Error('INVALID_ORIGIN');
  const api =
    process.env.ZALO_TEAM_CRM_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/api';
  const key = createHash('sha256')
    .update(JSON.stringify([api, origin, request.headers.get('cookie') || '']))
    .digest('hex');
  let pending = pendingAccess.get(key);
  if (!pending) {
    pending = readAccess(api, origin!, request.headers.get('cookie') || '');
    pendingAccess.set(key, pending);
    void pending
      .finally(() => {
        if (pendingAccess.get(key) === pending) pendingAccess.delete(key);
      })
      .catch(() => {});
  }
  // In-flight coalescing only: the next request rechecks current CRM rights.
  return structuredClone(await pending);
}
async function readAccess(api: string, origin: string, cookie: string): Promise<AccountAccess> {
  const auth = await fetch(`${api.replace(/\/$/, '')}/auth/zalo-team`, {
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
      Origin: origin!,
      Referer: origin + '/',
    },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!auth.ok) throw Error(auth.status === 401 ? 'CRM_LOGIN_REQUIRED' : 'CRM_UNAVAILABLE');
  const result = await auth.json();
  const user = result.user || result.data?.user || result.data || result;
  if (!user.id || user.is_active !== true) throw Error('CRM_LOGIN_REQUIRED');
  if (!user.zalo_access || !/^[a-f0-9]{64}$/.test(user.zalo_access.owner || ''))
    throw Error('WEB_ACCESS_DENIED');
  return user.zalo_access;
}
export async function authenticatedOwner(request: Request) {
  // Legacy callers must not silently gain shared workspace access.
  const access = await authenticatedAccess(request);
  if (!access.admin) throw Error('WEB_ACCESS_DENIED');
  return access.owner;
}
export async function accessCommand(
  request: Request,
  body: unknown,
  endpoint: 'access' | 'workspace' = 'access',
) {
  const api =
    process.env.ZALO_TEAM_CRM_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/api';
  const cookie = request.headers.get('cookie') || '';
  const xsrf = cookie
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('XSRF-TOKEN='))
    ?.slice(11);
  return fetch(api.replace(/\/$/, '') + '/zalo-team/' + endpoint, {
    method: 'POST',
    cache: 'no-store',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: cookie,
      Origin: process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin,
      Referer: (process.env.ZALO_TEAM_PUBLIC_ORIGIN || new URL(request.url).origin) + '/',
      ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });
}
export async function connectorAccess() {
  const token = (
    await fs.readFile(
      process.env.ZALO_TEAM_WEB_TOKEN_FILE ||
        path.resolve(process.cwd(), '../../tooling/zalo-team/.local/web-token'),
      'utf8',
    )
  ).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error('WEB_NOT_PREPARED');
  return {
    token,
    url: (process.env.ZALO_TEAM_WEB_URL || 'http://127.0.0.1:9250').replace(/\/$/, ''),
  };
}
