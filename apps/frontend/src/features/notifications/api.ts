import { api } from '@/services/api/client';
import type { NotificationPage, NotificationSummary, UserNotification } from '@/types/notification';

export async function getNotificationSummary() {
  const response = await api.get<NotificationSummary>('/notifications/summary');
  return response.data;
}

export async function getNotifications(
  page = 1,
  filter: 'all' | 'unread' | 'action' | 'archived' = 'all',
) {
  const response = await api.get<NotificationPage>('/notifications', {
    params: { page, per_page: 10, filter },
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

export async function archiveNotification(id: number) {
  await api.post(`/notifications/${id}/archive`);
}

export async function restoreNotification(id: number) {
  await api.post(`/notifications/${id}/restore`);
}
