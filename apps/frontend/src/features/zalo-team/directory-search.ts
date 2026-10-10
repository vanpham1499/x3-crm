import { useEffect, useRef, useState } from 'react';
import { directoryConversation, directoryRequest } from './directory';
import type { Conversation, ConversationListResponse } from './types';

type Account = ConversationListResponse['accounts'][number];
type AccountResults = {
  items: Conversation[];
  next: number | null;
  error: boolean;
  offset: number;
};
type Results = { key: string; accounts: Record<number, AccountResults> };

export function useDirectorySearch(
  query: string,
  accountId: string,
  accounts: Account[],
  reload: number,
) {
  const eligible = accounts.filter((a) => !accountId || String(a.id) === accountId);
  const key = JSON.stringify([query.trim(), eligible.map((a) => [a.id, a.state]), reload]);
  const [result, setResult] = useState<Results>({ key: '', accounts: {} });
  const latest = useRef({ result, eligible });
  latest.current = { result, eligible };
  const [request, setRequest] = useState({ key: '', more: false, sequence: 0 });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    if (!query.trim() || !latest.current.eligible.length) {
      setLoading(false);
      return;
    }
    const old = latest.current.result;
    const continuing = old.key === key && request.key === key;
    const targets = latest.current.eligible.flatMap((account) => {
      const previous = continuing ? old.accounts[account.id] : undefined;
      const offset = previous?.error
        ? previous.offset
        : request.more && previous
          ? previous.next
          : 0;
      if (continuing && !previous?.error && (!request.more || offset === null)) return [];
      return [{ account, offset: offset ?? 0 }];
    });
    setLoading(true);
    const timer = setTimeout(async () => {
      const responses = await Promise.allSettled(
        targets.map(async ({ account, offset }) => {
          const page = await directoryRequest(
            account.id,
            { kind: 'search', query: query.trim(), offset },
            controller.signal,
          );
          return {
            items: (page.items || []).map((p) => ({
              ...directoryConversation(p, account),
              preview: p.group ? 'Nhóm đã tham gia' : 'Bạn bè',
            })),
            next: page.nextOffset ?? null,
            offset,
            error: false,
          } satisfies AccountResults;
        }),
      );
      if (controller.signal.aborted) return;
      setResult((current) => {
        const merged = current.key === key ? { ...current.accounts } : {};
        responses.forEach((response, index) => {
          const { account, offset } = targets[index];
          const previous = merged[account.id];
          if (response.status === 'rejected') {
            merged[account.id] = {
              items: previous?.items || [],
              next: previous?.next ?? null,
              offset,
              error: true,
            };
          } else {
            const page = response.value;
            const items = offset ? [...(previous?.items || []), ...page.items] : page.items;
            merged[account.id] = {
              ...page,
              items: [...new Map(items.map((item) => [item.id, item])).values()],
            };
          }
        });
        return { key, accounts: merged };
      });
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Account objects refresh with live inbox updates; identity/state changes are encoded in key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, request]);
  const current = result.key === key && query.trim() ? result.accounts : {};
  return {
    conversations: Object.values(current).flatMap((value) => value.items),
    loading,
    error: eligible
      .filter((a) => current[a.id]?.error)
      .map((a) => a.name)
      .join(', '),
    hasMore: Object.values(current).some((value) => value.next !== null),
    loadMore: () => setRequest((old) => ({ key, more: true, sequence: old.sequence + 1 })),
    retry: () => setRequest((old) => ({ key, more: false, sequence: old.sequence + 1 })),
  };
}
