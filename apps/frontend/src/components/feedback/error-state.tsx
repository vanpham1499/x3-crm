'use client';

import Image from 'next/image';
import Link from 'next/link';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

type ErrorStateProps = {
  code?: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  compact?: boolean;
  onRetry?: () => void;
};

export function ErrorState({
  code = '404',
  title,
  description,
  primaryHref = '/dashboard',
  primaryLabel = 'Về Dashboard',
  secondaryHref = '/login',
  secondaryLabel = 'Đăng nhập',
  compact = false,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className={`relative isolate flex w-full items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 dark:bg-slate-950 ${
        compact ? 'min-h-[calc(100vh-72px)]' : 'min-h-screen'
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-400 to-orange-400" />
      <div className="pointer-events-none absolute left-1/2 top-10 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1fr)]">
        <section className="text-center lg:text-left">
          <div className="mb-8 flex justify-center lg:justify-start">
            <Image src={x3salesLogo} alt="X3Sales" width={144} height={52} priority className="h-auto w-36" />
          </div>

          <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">{code}</p>
          <h1 className="mt-4 text-4xl font-black text-slate-950 dark:text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500 dark:text-slate-300 lg:mx-0">
            {description}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <RefreshRoundedIcon fontSize="small" />
                Thử lại
              </button>
            ) : (
              <Link
                href={primaryHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <DashboardRoundedIcon fontSize="small" />
                {primaryLabel}
              </Link>
            )}

            <Link
              href={secondaryHref}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-primary hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              {secondaryHref === '/' ? <HomeRoundedIcon fontSize="small" /> : <ArrowBackRoundedIcon fontSize="small" />}
              {secondaryLabel}
            </Link>
          </div>
        </section>

        <section aria-hidden="true" className="mx-auto w-full max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-primary/10 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 items-center gap-2 border-b border-slate-100 px-5 dark:border-slate-800">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-auto h-2 w-24 rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>

            <div className="grid gap-4 p-5">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <div className="mb-4 flex items-center justify-between">
                  <span className="h-3 w-28 rounded-full bg-emerald-200 dark:bg-emerald-800" />
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-white">X3</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <span className="h-20 rounded-lg bg-white shadow-sm dark:bg-slate-900" />
                  <span className="h-20 rounded-lg bg-white shadow-sm dark:bg-slate-900" />
                  <span className="h-20 rounded-lg bg-white shadow-sm dark:bg-slate-900" />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                {[0, 1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className="grid grid-cols-[36px_1fr_96px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800"
                  >
                    <span className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800" />
                    <span className="space-y-2">
                      <span className="block h-2.5 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
                      <span className="block h-2 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800" />
                    </span>
                    <span className="h-7 rounded-full bg-primary/10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
