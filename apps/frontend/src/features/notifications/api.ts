import { api } from '@/services/api/client';
import type { NotificationPage, NotificationSummary, UserNotification } from '@/types/notification';

export async function getNotificationSummary(signal?: AbortSignal) {
  const response = await api.get<NotificationSummary>('/notifications/summary', { signal });
  return response.data;
}

export async function getNotifications(
  page = 1,
  filter: 'all' | 'done' = 'all',
  module = '',
  unread = false,
  signal?: AbortSignal,
) {
  const response = await api.get<NotificationPage>('/notifications', {
    params: { page, per_page: 20, filter, module: module || undefined, unread: unread ? 1 : 0 },
    signal,
  });
  return response.data;
}

export async function markNotificationRead(id: number) {
  const response = await api.patch<UserNotification>(`/notifications/${id}/read`);
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await api.post<{ message: string; updatedCount: number }>(
    '/notifications/read-all',
  );
  return response.data;
}

export async function handleNotification(id: number) {
  await api.post(`/notifications/${id}/handle`);
}

export type NotificationHandlingPreview = { count: number; token: string };

export async function previewHandleAllNotifications(module: string, unread: boolean) {
  const response = await api.post<NotificationHandlingPreview>(
    '/notifications/handle-all/preview',
    {
      module: module || undefined,
      unread,
    },
  );
  return response.data;
}

export async function handleAllNotifications(token: string) {
  const response = await api.post<{ updatedCount: number }>('/notifications/handle-all', { token });
  return response.data;
}

export async function restoreNotification(id: number) {
  await api.post(`/notifications/${id}/restore`);
}
