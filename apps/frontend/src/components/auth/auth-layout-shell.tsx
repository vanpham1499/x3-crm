'use client';

import Image from 'next/image';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { ReactNode } from 'react';
import { siteConfig } from '@/config/site';
import backgroundBlur from '@assets/images/background-3-blur.webp';
import dashboardIllustration from '@assets/images/illustration-dashboard.webp';
import amplifyIcon from '@assets/icons/ic-amplify.svg';
import auth0Icon from '@assets/icons/ic-auth0.svg';
import firebaseIcon from '@assets/icons/ic-firebase.svg';
import jwtIcon from '@assets/icons/ic-jwt.svg';
import supabaseIcon from '@assets/icons/ic-supabase.svg';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

const platformIcons = [
  { src: jwtIcon, alt: 'JWT' },
  { src: firebaseIcon, alt: 'Firebase' },
  { src: amplifyIcon, alt: 'Amplify' },
  { src: auth0Icon, alt: 'Auth0' },
  { src: supabaseIcon, alt: 'Supabase' },
];

export function AuthLayoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="absolute inset-x-0 top-0 z-10 flex h-[72px] items-center justify-between px-6">
        <Image
          src={x3salesLogo}
          alt={`${siteConfig.companyName} logo`}
          width={128}
          height={46}
          priority
          className="h-auto w-28"
        />

        <div className="flex items-center gap-4">
          <button type="button" className="hidden text-sm font-bold text-slate-950 sm:inline-flex">
            Cần hỗ trợ?
          </button>
          <button
            type="button"
            title="Cài đặt"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <SettingsRoundedIcon fontSize="small" />
          </button>
        </div>
      </header>

      <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[480px_minmax(0,1fr)]">
        <section className="relative hidden overflow-hidden border-r border-slate-100 pt-[98px] lg:flex lg:flex-col lg:items-center">
          <Image src={backgroundBlur} alt="" fill priority className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-white/90" />

          <div className="w-[316px] text-center">
            <h1 className="text-[32px] font-bold leading-[1.5]">Chào mừng trở lại</h1>
            <p className="mt-3 text-base text-slate-500">
              Quản lý khách hàng và đội ngũ hiệu quả hơn trong một nền tảng.
            </p>
          </div>

          <div className="mt-16 flex justify-center">
            <Image
              src={dashboardIllustration}
              alt="Minh họa dashboard"
              width={432}
              height={324}
              priority
              className="h-auto w-[432px] max-w-full"
            />
          </div>

          <div className="mt-16 flex justify-center gap-4">
            {platformIcons.map((icon) => (
              <Image
                key={icon.alt}
                src={icon.src}
                alt={icon.alt}
                width={32}
                height={32}
                className="h-8 w-8 opacity-50 grayscale transition hover:opacity-100 hover:grayscale-0"
              />
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-24">
          <div className="w-full max-w-[420px]">
            <div className="mb-10 lg:hidden">
              <Image
                src={x3salesLogo}
                alt={`${siteConfig.companyName} logo`}
                width={132}
                height={48}
                className="mb-8 h-auto w-[132px]"
              />
              <h1 className="text-[32px] font-bold leading-[1.5]">Chào mừng trở lại</h1>
              <p className="mt-3 text-slate-500">
                Quản lý khách hàng và đội ngũ hiệu quả hơn trong một nền tảng.
              </p>
            </div>

            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
