'use client';
import { createContext, createElement, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { initializeCsrfProtection } from '@/services/api/client';
import type { AccountAccess } from './account-access';
import { teamFetch, teamApiPolicy } from './request';

let csrf: Promise<unknown> | undefined;
async function refreshCsrf() {
  csrf ??= initializeCsrfProtection().finally(() => {
    csrf = undefined;
  });
  await csrf;
}
export async function accessRequest(body: Record<string, unknown>, signal?: AbortSignal) {
  if (!document.cookie.split(';').some((c) => c.trim().startsWith('XSRF-TOKEN=')))
    await refreshCsrf();
  const send = () =>
    teamFetch('/api/zalo-team/access', {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  let response = await send();
  // Only 419 is safe to retry: CRM rejected CSRF before executing the command.
  if (response.status === 419) {
    await refreshCsrf();
    response = await send();
  }
  const data = await response.json();
  if (!response.ok) throw Error(data.message || 'Chưa xác nhận được quyền Zalo.');
  return data;
}
const Context = createContext<{ access: AccountAccess | null; failed: boolean }>({
  access: null,
  failed: false,
});
export function AccountAccessProvider({ children }: { children: ReactNode }) {
  const query = useQuery<{ access: AccountAccess }>({
    queryKey: ['account-access'],
    queryFn: ({ signal }) => accessRequest({ kind: 'scope' }, signal),
    staleTime: teamApiPolicy.accessInterval,
    refetchInterval: teamApiPolicy.accessInterval,
    refetchOnWindowFocus: true,
  });
  const fingerprint = useRef('');
  useEffect(() => {
    const access = query.data?.access;
    if (!access || query.isError) return;
    const next = JSON.stringify([
      access.owner,
      access.userId,
      access.admin,
      access.teams,
      access.accounts,
    ]);
    // Drop the whole scoped UI/cache when grants change; every API also checks CRM rights.
    if (fingerprint.current && fingerprint.current !== next) {
      window.location.reload();
      return;
    }
    fingerprint.current = next;
  }, [query.data, query.isError]);
  return createElement(
    Context.Provider,
    {
      value: {
        access: query.isError ? null : query.data?.access || null,
        failed: query.isError,
      },
    },
    children,
  );
}
export function useAccountAccess() {
  return useContext(Context).access;
}
export function useAccountAccessError() {
  return useContext(Context).failed;
}
