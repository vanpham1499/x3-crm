'use client';
import { useEffect, useState } from 'react';
import { useAccountAccess } from './use-account-access';

// Presentation preference only, scoped to this CRM user and browser origin.
// Never changes account rights, native groups or the shared manual links.
export function useGroupPreferences() {
  const access = useAccountAccess();
  const key = access?.userId ? `zalo-team:group-account:v1:${access.userId}` : '';
  const [state, setState] = useState<{ key: string; values: Record<string, number> }>({
    key: '',
    values: {},
  });
  useEffect(() => {
    if (!key) return;
    const read = () => {
      let values: Record<string, number> = {};
      try {
        const raw = JSON.parse(localStorage.getItem(key) || '{}');
        if (raw && typeof raw === 'object' && !Array.isArray(raw))
          values = Object.fromEntries(
            Object.entries(raw)
              .filter(
                ([id, account]) =>
                  /^auto:[A-Za-z0-9_-]{1,128}$/.test(id) &&
                  Number.isSafeInteger(account) &&
                  Number(account) > 0,
              )
              .slice(-1000),
          ) as Record<string, number>;
      } catch {
        /* Private browsing may disable persistence. */
      }
      setState({ key, values });
    };
    read();
    const changed = (event: StorageEvent) => {
      if (event.key === key || event.key === null) read();
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [key]);
  return {
    values: state.key === key ? state.values : {},
    remember(id: string, account: number | null) {
      if (!key || !/^auto:[A-Za-z0-9_-]{1,128}$/.test(id)) return;
      const values = { ...(state.key === key ? state.values : {}) };
      delete values[id];
      if (account !== null) values[id] = account;
      const bounded = Object.fromEntries(Object.entries(values).slice(-1000));
      // Report storage failure to the caller instead of claiming it was saved.
      localStorage.setItem(key, JSON.stringify(bounded));
      setState({ key, values: bounded });
    },
  };
}
