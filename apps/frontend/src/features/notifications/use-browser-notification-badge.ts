'use client';

import { useEffect } from 'react';
import { siteConfig } from '@/config/site';

const FAVICON_URL = '/favicon.png';
const DYNAMIC_FAVICON_ID = 'notification-favicon';

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function faviconLink(): HTMLLinkElement {
  const current = document.getElementById(DYNAMIC_FAVICON_ID) as HTMLLinkElement | null;
  if (current) return current;

  const link = document.createElement('link');
  link.id = DYNAMIC_FAVICON_ID;
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = FAVICON_URL;
  document.head.appendChild(link);

  return link;
}

export function useBrowserNotificationBadge(unreadCount: number) {
  useEffect(
    () => () => {
      document.title = siteConfig.name;
      faviconLink().href = FAVICON_URL;
      const badgeNavigator = navigator as BadgeNavigator;
      void badgeNavigator.clearAppBadge?.().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    const count = Math.max(0, unreadCount);
    const label = count > 99 ? '99+' : String(count);
    const link = faviconLink();
    const badgeNavigator = navigator as BadgeNavigator;
    let cancelled = false;

    document.title = count > 0 ? `(${label}) ${siteConfig.name}` : siteConfig.name;

    if (count > 0) {
      void badgeNavigator.setAppBadge?.(count).catch(() => undefined);
    } else {
      void badgeNavigator.clearAppBadge?.().catch(() => undefined);
      link.href = FAVICON_URL;
      return;
    }

    const logo = new Image();
    logo.onload = () => {
      if (cancelled) return;

      const size = 96;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) return;

      context.drawImage(logo, 0, 0, size, size);
      context.beginPath();
      context.arc(72, 24, 22, 0, Math.PI * 2);
      context.fillStyle = '#dc2626';
      context.fill();
      context.lineWidth = 5;
      context.strokeStyle = '#ffffff';
      context.stroke();
      context.fillStyle = '#ffffff';
      context.font = `700 ${label.length > 2 ? 19 : 25}px Arial, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, 72, 25);

      link.href = canvas.toDataURL('image/png');
    };
    logo.src = FAVICON_URL;

    return () => {
      cancelled = true;
    };
  }, [unreadCount]);
}
