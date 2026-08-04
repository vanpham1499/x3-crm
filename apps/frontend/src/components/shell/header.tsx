'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import { NotificationCenter } from '@/features/notifications/components/notification-center';
import { ProfileCenter } from '@/features/profile/components/profile-center';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

const WEEKDAY_LABELS = [
  'Chủ nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];
const headerDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const headerTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function HeaderDateTime() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());

    updateTime();
    const timer = window.setInterval(updateTime, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const dateLabel = currentTime
    ? `${WEEKDAY_LABELS[currentTime.getDay()]}, ${headerDateFormatter.format(currentTime)}`
    : 'Hôm nay, --/--/----';
  const timeLabel = currentTime ? headerTimeFormatter.format(currentTime) : '--:--';

  return (
    <div className="hidden items-center gap-1 lg:flex">
      <span className="grid size-10 shrink-0 place-items-center text-slate-500 dark:text-slate-300">
        <CalendarMonthRoundedIcon />
      </span>
      <p className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-600 dark:text-slate-300">
        <span>{dateLabel}</span>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
          ·
        </span>
        <time
          dateTime={currentTime?.toISOString()}
          className="font-extrabold tabular-nums text-slate-900 dark:text-slate-100"
        >
          {timeLabel}
        </time>
      </p>
    </div>
  );
}

function HeaderIconButton({
  children,
  className = '',
  onClick,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    >
      {children}
    </button>
  );
}

export type HeaderUtility = 'calculator' | 'notifications' | 'profile';

type HeaderProps = {
  activeUtility?: HeaderUtility | null;
  onToggleUtility?: (utility: HeaderUtility) => void;
};

export function Header({ activeUtility = null, onToggleUtility }: HeaderProps) {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('x3_theme');
    const nextTheme = savedTheme === 'dark' ? 'dark' : 'light';

    setThemeMode(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const nextTheme = themeMode === 'dark' ? 'light' : 'dark';

    setThemeMode(nextTheme);
    localStorage.setItem('x3_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between bg-white/80 px-4 backdrop-blur-md dark:bg-slate-950/80 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <HeaderIconButton title="Mở menu" className="lg:hidden">
          <MenuRoundedIcon />
        </HeaderIconButton>

        <div className="mr-1 block lg:hidden">
          <Image
            src={x3salesLogo}
            alt="X3Sales logo"
            width={112}
            height={40}
            className="h-auto w-28"
          />
        </div>

        <HeaderDateTime />
      </div>

      <div className="flex items-center gap-1">
        <HeaderIconButton
          title={activeUtility === 'calculator' ? 'Ẩn máy tính' : 'Mở máy tính'}
          onClick={() => onToggleUtility?.('calculator')}
          className={
            activeUtility === 'calculator'
              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700'
              : ''
          }
        >
          <CalculateRoundedIcon />
        </HeaderIconButton>

        <NotificationCenter
          open={activeUtility === 'notifications'}
          onToggle={() => onToggleUtility?.('notifications')}
          onClose={() => {
            if (activeUtility === 'notifications') onToggleUtility?.('notifications');
          }}
        />

        <button
          type="button"
          title={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          onClick={toggleTheme}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {themeMode === 'dark' ? <WbSunnyRoundedIcon /> : <DarkModeRoundedIcon />}
        </button>

        <ProfileCenter
          open={activeUtility === 'profile'}
          onToggle={() => onToggleUtility?.('profile')}
          onClose={() => {
            if (activeUtility === 'profile') onToggleUtility?.('profile');
          }}
        />
      </div>
    </header>
  );
}
