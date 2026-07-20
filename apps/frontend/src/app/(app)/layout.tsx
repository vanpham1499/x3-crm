'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalculatorPanel } from '@/components/shell/calculator-panel';
import { ErrorState } from '@/components/feedback/error-state';
import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';
import { AppSplashScreen } from '@/components/shell/app-splash-screen';
import { hasPermission } from '@/lib/ownership';
import { getRequiredPermissionsForPath } from '@/lib/route-permissions';
import { useAuthStore } from '@/stores/auth-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, init, verify, user } = useAuthStore();
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const verifiedPathRef = useRef(pathname);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated' || verifiedPathRef.current === pathname) return;

    verifiedPathRef.current = pathname;
    void verify();
  }, [pathname, status, verify]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const verifyOnFocus = () => void verify();
    window.addEventListener('focus', verifyOnFocus);

    return () => window.removeEventListener('focus', verifyOnFocus);
  }, [status, verify]);

  if (status === 'checking' || status === 'unauthenticated') {
    return <AppSplashScreen label="Dang kiem tra dang nhap" />;
  }

  if (status === 'unavailable') {
    return (
      <ErrorState
        code="503"
        title="Không kết nối được máy chủ"
        description="Hệ thống chưa thể xác minh phiên đăng nhập vì backend đang không phản hồi. Vui lòng khởi động lại backend hoặc thử lại sau."
        secondaryHref="/login"
        secondaryLabel="Về đăng nhập"
        onRetry={() => void init()}
      />
    );
  }

  const requiredPermissions = getRequiredPermissionsForPath(pathname);
  const hasAccess =
    !requiredPermissions || requiredPermissions.some((code) => hasPermission(user, code));

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
          {hasAccess ? (
            children
          ) : (
            <ErrorState
              compact
              code="403"
              title="Không có quyền truy cập"
              description="Bạn không có quyền truy cập vào chức năng này. Vui lòng liên hệ quản trị viên nếu cần được cấp quyền."
              primaryHref="/dashboard"
              primaryLabel="Về Dashboard"
              secondaryHref="/dashboard"
              secondaryLabel="Quay lại"
            />
          )}
        </main>
      </div>
    </div>
  );
}
