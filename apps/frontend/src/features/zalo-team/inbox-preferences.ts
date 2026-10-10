'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { archiveRequest } from './archive';
import { useAccountAccess } from './use-account-access';

export function useInboxPreferences() {
  const access = useAccountAccess();
  const client = useQueryClient();
  const key = ['inbox-preferences', access?.userId];
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const query = useQuery({
    queryKey: key,
    enabled: !!access,
    queryFn: ({ signal }) =>
      archiveRequest<{ archived: string[] }>({ kind: 'inbox-preferences' }, signal),
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
  return {
    archived: new Set(query.data?.archived || []),
    ready: !!query.data,
    error: query.error,
    retry: query.refetch,
    saving,
    async set(sources: string[], archived: boolean) {
      if (locked.current) throw Error('Đang lưu thay đổi. Vui lòng chờ.');
      locked.current = true;
      setSaving(true);
      try {
        await client.cancelQueries({ queryKey: key });
        const value = await archiveRequest<{ archived: string[] }>({
          kind: 'inbox-archive',
          sources,
          archived,
        });
        client.setQueryData(key, value);
      } finally {
        locked.current = false;
        setSaving(false);
      }
    },
  };
}
