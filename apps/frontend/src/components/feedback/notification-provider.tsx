'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AlertColor } from '@mui/material';
import { Alert, Snackbar } from '@mui/material';

type NotificationPayload = {
  message: string;
  severity?: AlertColor;
};

type NotificationContextValue = {
  notify: (payload: NotificationPayload) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function AppNotificationProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [notification, setNotification] = useState<Required<NotificationPayload>>({
    message: '',
    severity: 'success',
  });

  const notify = useCallback((payload: NotificationPayload) => {
    setNotification({
      message: payload.message,
      severity: payload.severity || 'success',
    });
    setOpen(true);
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notify,
      success: (message) => notify({ message, severity: 'success' }),
      error: (message) => notify({ message, severity: 'error' }),
      warning: (message) => notify({ message, severity: 'warning' }),
      info: (message) => notify({ message, severity: 'info' }),
    }),
    [notify],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={3600}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setOpen(false);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          variant="filled"
          severity={notification.severity}
          onClose={() => setOpen(false)}
          className="min-w-80 rounded-xl shadow-lg"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useAppNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useAppNotification must be used inside AppNotificationProvider');
  }

  return context;
}
