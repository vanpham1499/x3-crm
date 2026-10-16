'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeEcho } from '@/features/notifications/realtime';

export function useNotificationRealtime(userId?: number, enabled = false) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    setConnected(false);
    if (!enabled || !userId) return;
    const echo = getRealtimeEcho();
    if (!echo) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      timer = setTimeout(() => {
        void client.invalidateQueries({ queryKey: ['notifications', userId] });
      }, 250);
    };
    const channelName = `users.${userId}`;
    const notificationChanged = (event: { entityType?: string; entityId?: number | string }) => {
      refresh();
      if (event.entityType === 'weekly_report' && event.entityId) {
        void client.invalidateQueries({ queryKey: ['weekly-reports', String(event.entityId)] });
      }
    };
    const channel = echo.private(channelName);
    const connection = echo.connector.pusher.connection;
    const subscribed = () => {
      setConnected(true);
      refresh();
    };
    const disconnected = () => setConnected(false);
    channel
      .listen('.notifications.changed', notificationChanged)
      .subscribed(subscribed)
      .error(disconnected);
    connection.bind('disconnected', disconnected);
    connection.bind('unavailable', disconnected);
    connection.bind('failed', disconnected);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      channel.stopListening('.notifications.changed', notificationChanged);
      connection.unbind('disconnected', disconnected);
      connection.unbind('unavailable', disconnected);
      connection.unbind('failed', disconnected);
      echo.leave(channelName);
    };
  }, [enabled, client, userId]);
  return connected;
}
