'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { AccountAccessProvider } from '../use-account-access';
import { setTeamRequestIdentity } from '../request';

function SessionData({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60000,
            gcTime: 120000,
            retry: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchIntervalInBackground: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  useEffect(
    () => () => {
      void client.cancelQueries();
      client.clear();
    },
    [client],
  );
  return (
    <QueryClientProvider client={client}>
      <AccountAccessProvider>{children}</AccountAccessProvider>
    </QueryClientProvider>
  );
}
export function TeamDataProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id);
  const status = useAuthStore((s) => s.status);
  // Set the transport namespace before children schedule work; changing a CRM
  // identity cancels old reads, while Strict Mode remounts keep the same scope.
  if (typeof window !== 'undefined') setTeamRequestIdentity(`${status}:${userId || 'anonymous'}`);
  if (status === 'checking') return <div role="status">Đang xác nhận phiên CRM…</div>;
  if (status !== 'authenticated')
    return (
      <div role="alert">
        Chưa xác nhận được phiên CRM. <a href="/login">Đăng nhập lại</a>
      </div>
    );
  // No persisted chat cache. A CRM identity/session change destroys this client.
  return <SessionData key={`${status}:${userId || 'anonymous'}`}>{children}</SessionData>;
}
