'use client';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import 'dayjs/locale/vi';
import { AppNotificationProvider } from '@/components/feedback/notification-provider';
import { useAuthStore } from '@/stores/auth-store';
import { muiTheme } from '@/theme/mui-theme';

export function Providers({ children }: { children: React.ReactNode }) {
  const initAuth = useAuthStore((state) => state.init);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
      }),
  );

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={muiTheme}>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
          <CssBaseline />
          <QueryClientProvider client={queryClient}>
            <AppNotificationProvider>{children}</AppNotificationProvider>
          </QueryClientProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
