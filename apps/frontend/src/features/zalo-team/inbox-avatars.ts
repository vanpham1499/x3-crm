import { useQueries } from '@tanstack/react-query';
import { directoryRequest, type DirectoryPerson } from './directory';
import type { ConversationListResponse } from './types';

// Directory snapshots are reused across inbox renders; each account has its own key.
export function useInboxAvatars(
  accounts: ConversationListResponse['accounts'],
  accountId: string,
  reload: number,
) {
  const ids = accounts
    .filter((a) => a.state === 'connected' && (!accountId || String(a.id) === accountId))
    .map((a) => a.id)
    .sort((a, b) => a - b);
  const requests = ids.flatMap((id) =>
    (['friends', 'groups'] as const).map((kind) => ({ id, kind })),
  );
  const results = useQueries({
    queries: requests.map(({ id, kind }) => ({
      queryKey: ['directory-avatars', id, kind, reload],
      queryFn: ({ signal }: { signal: AbortSignal }) => directoryRequest(id, { kind }, signal),
      staleTime: 5 * 60000,
      refetchOnWindowFocus: false,
    })),
  });
  const people: Record<string, DirectoryPerson> = {};
  results.forEach((result, i) => {
    for (const person of result.data?.items || [])
      people[`${requests[i].id}:${person.id}`] = person;
  });
  return people;
}
