'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api/client';

export function KpiLiveRefresh() {
  const pathname = usePathname();
  const client = useQueryClient();
  const lastRevision = useRef<string>();
  const enabled = pathname.startsWith('/kpi') || pathname.startsWith('/dashboard');
  const { data } = useQuery({
    queryKey: ['finance-revision'],
    queryFn: ({ signal }) =>
      api.get<{ revision: string }>('/kpi/revision', { signal }).then((r) => r.data.revision),
    enabled,
    refetchInterval: enabled ? 30000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  useEffect(() => {
    if (lastRevision.current && data && lastRevision.current !== data) {
      void client.invalidateQueries({ queryKey: ['kpi'] });
      void client.invalidateQueries({ queryKey: ['dashboard'] });
    }
    if (data) lastRevision.current = data;
  }, [data, client]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('crm-finance') : null;
    const invalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void client.invalidateQueries({ queryKey: ['kpi'] });
        void client.invalidateQueries({ queryKey: ['dashboard'] });
      }, 250);
    };
    const onLocalChange = () => {
      invalidate();
      channel?.postMessage('changed');
    };
    if (channel) channel.onmessage = invalidate;
    window.addEventListener('crm:finance-changed', onLocalChange);
    return () => {
      clearTimeout(timer);
      channel?.close();
      window.removeEventListener('crm:finance-changed', onLocalChange);
    };
  }, [client]);
  return null;
}
