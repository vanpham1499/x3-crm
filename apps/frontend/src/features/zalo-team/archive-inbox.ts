import { useQuery } from '@tanstack/react-query';
import { archiveRequest } from './archive';
import { teamApiPolicy } from './request';
import type { Conversation } from './types';
type Row = Omit<Conversation, 'time' | 'color'>;
type Page = { conversations: Row[]; nextOffset: number | null };
export function useArchiveInbox(accountId: string, reload: number) {
  const query = useQuery({
    queryKey: ['archive-inbox', accountId, reload],
    queryFn: async ({ signal }) => {
      const rows = new Map<Conversation['id'], Row>();
      let offset = 0;
      do {
        const page = await archiveRequest<Page>(
          {
            kind: 'list-conversations',
            ...(accountId ? { accountId: Number(accountId) } : {}),
            offset,
          },
          signal,
        );
        for (const row of page.conversations) rows.set(row.id, row);
        if (page.nextOffset === null) break;
        if (page.nextOffset <= offset) throw Error('Danh sách kho chưa tải đầy đủ. Hãy thử lại.');
        offset = page.nextOffset;
      } while (!signal.aborted);
      return [...rows.values()];
    },
    staleTime: teamApiPolicy.archiveInterval,
    refetchInterval: teamApiPolicy.archiveInterval,
  });
  return {
    conversations: query.data || [],
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : '',
    retry: () => void query.refetch(),
  };
}
