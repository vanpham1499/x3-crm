'use client';

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { API_ORIGIN } from '@/services/api/client';

let echoInstance: Echo<'reverb'> | null = null;

export function getRealtimeEcho(): Echo<'reverb'> | null {
  if (typeof window === 'undefined' || process.env.NEXT_PUBLIC_REVERB_ENABLED !== 'true') {
    return null;
  }

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  if (!key) return null;

  if (echoInstance) return echoInstance;

  const scheme = process.env.NEXT_PUBLIC_REVERB_SCHEME || 'http';
  const forceTLS = scheme === 'https';
  const host = process.env.NEXT_PUBLIC_REVERB_HOST || window.location.hostname;
  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT || (forceTLS ? 443 : 8080));

  echoInstance = new Echo<'reverb'>({
    broadcaster: 'reverb',
    Pusher,
    key,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    channelAuthorization: {
      customHandler: async ({ socketId, channelName }, callback) => {
        try {
          const response = await fetch(`${API_ORIGIN}/broadcasting/auth`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: new URLSearchParams({
              socket_id: socketId,
              channel_name: channelName,
            }),
          });

          if (!response.ok) {
            throw new Error(`Broadcast authorization failed with status ${response.status}`);
          }

          callback(null, await response.json());
        } catch (error) {
          callback(error instanceof Error ? error : new Error('Broadcast authorization failed'), null);
        }
      },
    },
  });

  return echoInstance;
}
