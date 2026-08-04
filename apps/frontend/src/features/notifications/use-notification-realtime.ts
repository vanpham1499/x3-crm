'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeEcho } from '@/features/notifications/realtime';

export function useNotificationRealtime(userId?: number, enabled = false) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !userId) return;

    const echo = getRealtimeEcho();
    if (!echo) return;

    const refresh = () => {
      void queryClient.refetchQueries({
        queryKey: ['notifications', 'summary'],
        type: 'active',
      });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    };
    const channelName = `users.${userId}`;
    const channel = echo.private(channelName);
    const connection = echo.connector.pusher.connection;

    channel.listen('.notifications.changed', refresh).subscribed(refresh);
    connection.bind('connected', refresh);

    return () => {
      channel.stopListening('.notifications.changed', refresh);
      connection.unbind('connected', refresh);
      echo.leave(channelName);
    };
  }, [enabled, queryClient, userId]);
}
