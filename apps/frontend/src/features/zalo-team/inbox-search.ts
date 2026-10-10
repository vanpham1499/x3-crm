import { useEffect, useState } from 'react';
import { archiveRequest } from './archive';
import type { Conversation } from './types';

export const normalizeConversationName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi')
    .trim()
    .replace(/\s+/g, ' ');

type SearchPage = {
  conversations: Omit<Conversation, 'time' | 'color'>[];
  nextOffset: number | null;
};

export function useArchiveConversationSearch(query: string, accountId: string, reload: number) {
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([query.trim(), accountId, reload]);
  const [result, setResult] = useState<SearchPage & { key: string }>({
    key: '',
    conversations: [],
    nextOffset: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setOffset(0);
  }, [key]);
  useEffect(() => {
    const controller = new AbortController();
    if (!query.trim()) {
      setLoading(false);
      setError('');
      return;
    }
    // Reset pagination immediately for a new query; never append an old response.
    const pageOffset = result.key === key ? offset : 0;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      void archiveRequest<SearchPage>(
        {
          kind: 'search-conversations',
          query: query.trim(),
          ...(accountId ? { accountId: Number(accountId) } : {}),
          offset: pageOffset,
        },
        controller.signal,
      )
        .then((page) => {
          if (controller.signal.aborted) return;
          setResult((old) => ({
            ...page,
            key,
            conversations:
              pageOffset && old.key === key
                ? [
                    ...old.conversations,
                    ...page.conversations.filter(
                      (c) => !old.conversations.some((o) => o.id === c.id),
                    ),
                  ]
                : page.conversations,
          }));
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : 'Chưa tìm được trong kho đã lưu.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // result is used only to identify whether this request appends to the current query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, offset, retry]);
  return {
    conversations: query.trim() && result.key === key ? result.conversations : [],
    loading,
    error,
    hasMore: result.key === key && result.nextOffset !== null,
    loadMore: () => {
      if (result.nextOffset !== null) setOffset(result.nextOffset);
    },
    retry: () => setRetry((n) => n + 1),
  };
}
