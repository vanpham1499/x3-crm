'use client';

import Image from 'next/image';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { ROLE_LABELS } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

function HeaderIconButton({
  children,
  className = '',
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-primary ${className}`}
    >
      {children}
    </button>
  );
}

export function Header() {
  const { user } = useAuthStore();
  const displayName = user?.name || 'X3Sales';
  const displayRole = user?.role ? ROLE_LABELS[user.role] : 'Giao diện';

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between bg-white/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <HeaderIconButton title="Mở menu" className="lg:hidden">
          <MenuRoundedIcon />
        </HeaderIconButton>

        <div className="mr-1 block lg:hidden">
          <Image src={x3salesLogo} alt="X3Sales logo" width={112} height={40} className="h-auto w-28" />
        </div>

        <HeaderIconButton title="Tìm kiếm">
          <SearchRoundedIcon />
        </HeaderIconButton>

        <button
          type="button"
          className="hidden h-8 items-center gap-2 rounded-lg px-2 text-slate-950 transition hover:bg-slate-100 md:inline-flex"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            X3
          </span>
          <span className="text-sm font-bold">X3Sales CRM</span>
          <span className="text-xs font-bold text-slate-500">Free</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <HeaderIconButton title="Ngôn ngữ">
          <LanguageRoundedIcon />
        </HeaderIconButton>

        <HeaderIconButton title="Thông báo">
          <NotificationsNoneRoundedIcon />
          <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white">
            4
          </span>
        </HeaderIconButton>

        <HeaderIconButton title="Liên hệ" className="hidden sm:inline-flex">
          <GroupsRoundedIcon />
        </HeaderIconButton>

        <HeaderIconButton title="Cài đặt" className="hidden sm:inline-flex">
          <SettingsRoundedIcon />
        </HeaderIconButton>

        <button
          type="button"
          title={`${displayName} - ${displayRole}`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full p-1 transition hover:bg-slate-100"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {displayName.charAt(0)}
          </span>
        </button>
      </div>
    </header>
  );
}
