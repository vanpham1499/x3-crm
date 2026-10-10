import type { Conversation } from './types';
import type { WorkSummaries, WorkSummary } from './workspace';

export type WorkFilter = { person: string; state: string };
export const emptyWorkFilter: WorkFilter = { person: 'all', state: 'all' };
export function indexWork(summaries?: WorkSummaries) {
  return new Map((summaries?.items || []).map((w) => [`${w.accountId}:${w.conversationId}`, w]));
}
export function matchesWork(
  item: Pick<Conversation, 'accountId' | 'conversationId'>,
  filter: WorkFilter,
  index: Map<string, WorkSummary>,
  userId?: number,
): boolean {
  if (filter.person === 'all' && filter.state === 'all') return true;
  if (!userId) return false;
  const work = index.get(`${item.accountId}:${item.conversationId}`);
  // An unverified/unavailable source is not evidence of an unassigned conversation.
  if (!work) return false;
  return (
    (filter.state === 'all' || work.state === filter.state) &&
    (filter.person === 'all' ||
      (filter.person === 'unassigned'
        ? !work.assigneeId
        : work.assigneeId === (filter.person === 'mine' ? userId : Number(filter.person))))
  );
}
