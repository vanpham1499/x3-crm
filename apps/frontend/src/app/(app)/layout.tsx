'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalculatorPanel } from '@/components/shell/calculator-panel';
import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';
import { AppSplashScreen } from '@/components/shell/app-splash-screen';
import { useAuthStore } from '@/stores/auth-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { initialized, token } = useAuthStore();
  const [calculatorOpen, setCalculatorOpen] = useState(false);

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
      {calculatorOpen ? <CalculatorPanel /> : null}
      <div className="min-w-0 flex-1">
        <Header
          calculatorOpen={calculatorOpen}
          onToggleCalculator={() => setCalculatorOpen((value) => !value)}
        />
        <main className="min-h-[calc(100vh-72px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
