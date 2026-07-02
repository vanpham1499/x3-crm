'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';
import { AppSplashScreen } from '@/components/shell/app-splash-screen';
import { useAuthStore } from '@/stores/auth-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { initialized, token } = useAuthStore();

  useEffect(() => {
    if (initialized && !token) {
      router.replace('/login');
    }
  }, [initialized, router, token]);

  if (!initialized || !token) {
    return <AppSplashScreen label="Dang kiem tra dang nhap" />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Header />
        <main className="min-h-[calc(100vh-72px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
