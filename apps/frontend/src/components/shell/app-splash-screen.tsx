'use client';

import Image from 'next/image';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

type AppSplashScreenProps = {
  label?: string;
};

export function AppSplashScreen({ label = 'Dang tai' }: AppSplashScreenProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-white"
    >
      <div className="x3-splash" aria-hidden="true">
        <Image
          src={x3salesLogo}
          alt=""
          width={116}
          height={42}
          priority
          className="x3-splash-logo"
        />
        <div className="x3-splash-progress">
          <span />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
