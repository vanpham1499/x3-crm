'use client';

import Image from 'next/image';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

type AppSplashScreenProps = {
  label?: string;
};

export function AppSplashScreen({
  label = 'Đang tải hệ thống',
}: AppSplashScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className="x3-splash-screen fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center overflow-hidden bg-background"
    >
      <div className="x3-splash-grid" aria-hidden="true" />

      <div className="x3-splash relative flex w-full max-w-sm flex-col items-center px-6 text-center">
        <div className="x3-splash-logo-shell">
          <span className="x3-splash-logo-halo" aria-hidden="true" />
          <Image
            src={x3salesLogo}
            alt="X3Sales CRM"
            width={168}
            height={61}
            priority
            className="x3-splash-logo"
          />
        </div>

        <div className="x3-splash-progress mt-7" aria-hidden="true">
          <span />
        </div>

        <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          X3Sales CRM
        </p>
      </div>
    </div>
  );
}
