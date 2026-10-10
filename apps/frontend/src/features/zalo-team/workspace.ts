'use client';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { teamFetch } from './request';
import type { Conversation } from './types';

export const workStates = {
  needs_action: 'Cần xử lý',
  in_progress: 'Đang xử lý',
  waiting_customer: 'Chờ khách',
  resolved: 'Đã xử lý',
} as const;
export type WorkState = keyof typeof workStates;
export type CrmLink = {
  kind: 'lead' | 'customer' | 'project';
  id: number;
  name: string;
  code: string;
  sales?: string;
  manager?: string;
  service?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};
export type Workspace = {
  taskCandidates: { id: number; name: string }[];
  openTaskCount: number;
  selectedTask?: WorkTask | null;
  colleagues: { id: number; name: string }[];
  canCollaborate: boolean;
  userId: number;
  notes: WorkNote[];
  hasMoreNotes: boolean;
  tasks: WorkTask[];
  hasMoreTasks: boolean;
  revision: number;
  state: WorkState;
  assignee: { id: number; name: string } | null;
  assignmentUnavailable: boolean;
  canManage: boolean;
  canClaim: boolean;
  canEdit: boolean;
  candidates: { id: number; name: string }[];
  links: CrmLink[];
  restrictedLinks: boolean;
  events: {
    id: number;
    action: string;
    actor: string;
    at: string;
    state?: WorkState;
    assignee?: string;
  }[];
};
export type WorkNote = {
  id: number;
  body: string;
  author: string;
  authorId: number;
  mentions: { id: number; name: string }[];
  at: string;
};
export type WorkTask = {
  id: number;
  title: string;
  description: string | null;
  status: 'todo' | 'doing' | 'done' | 'cancelled';
  assigneeId: number;
  assignee: string;
  dueAt: string;
  repeat: 'none' | 'weekly' | 'renewal';
  revision: number;
  sourceMessageId: string | null;
  sourceMessageTime?: number | null;
  overdue: boolean;
  projectId?: number | null;
};
export const taskStates = {
  todo: 'Cần làm',
  doing: 'Đang làm',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
};
export function workUrl(
  accountId: number,
  conversationId: string,
  messageId?: string | null,
  messageTime?: number | null,
) {
  return `/zalo-team?workAccount=${accountId}&workPeer=${encodeURIComponent(conversationId)}${messageId && messageTime ? `&workMessage=${encodeURIComponent(messageId)}&workTime=${messageTime}` : ''}`;
}
export type WorkSummary = {
  accountId: number;
  conversationId: string;
  state: WorkState;
  assigneeId: number | null;
  assigneeName: string | null;
};
export type WorkSummaries = { items: WorkSummary[]; userId: number; canManage: boolean };
export function workRef(c: Conversation) {
  return { accountId: c.accountId, conversationId: c.conversationId };
}
// Mutations return a complete fresh panel. Do not immediately fetch it a second time.
export function publishWorkspace(
  client: QueryClient,
  accountId: number,
  conversationId: string,
  next: Workspace,
) {
  const key = ['workspace', 'detail', accountId, conversationId];
  client.setQueryData(key, next);
  void client.invalidateQueries({
    queryKey: ['workspace'],
    predicate: (q) =>
      !(q.queryKey.length === key.length && q.queryKey.every((v, i) => v === key[i])),
  });
}
export async function workspaceRequest<T>(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await teamFetch('/api/zalo-team/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Chưa cập nhật được hồ sơ hội thoại.');
  return result;
}
export function useWorkSummaries(enabled: boolean) {
  return useQuery<WorkSummaries>({
    queryKey: ['workspace', 'summaries'],
    enabled,
    queryFn: ({ signal }) => workspaceRequest({ kind: 'summaries' }, signal),
    staleTime: 15000,
    retry: false,
    // One read on opening the filter, explicit refresh and invalidation after local edits.
    refetchOnWindowFocus: true,
  });
}
