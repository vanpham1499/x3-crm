'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import { Avatar, Menu, MenuItem } from '@mui/material';
import { getMediaPreviewUrl } from '@/lib/media-url';
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
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    >
      {children}
    </button>
  );
}

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [accountAnchorEl, setAccountAnchorEl] = useState<HTMLElement | null>(null);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const displayName = user?.name || user?.email || user?.code || 'X3Sales';
  const displayRole = user?.role ? ROLE_LABELS[user.role] : 'Giao diện';
  const displayInitial = displayName.trim().charAt(0).toUpperCase() || 'X';
  const accountMenuOpen = Boolean(accountAnchorEl);

  useEffect(() => {
    const savedTheme = localStorage.getItem('x3_theme');
    const nextTheme = savedTheme === 'dark' ? 'dark' : 'light';

    setThemeMode(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, []);

  const openAccountMenu = (event: MouseEvent<HTMLButtonElement>) => {
    setAccountAnchorEl(event.currentTarget);
  };

  const closeAccountMenu = () => {
    setAccountAnchorEl(null);
  };

  const goToProfile = () => {
    closeAccountMenu();
    router.push('/profile');
  };

  const handleLogout = () => {
    closeAccountMenu();
    logout();
    router.replace('/login');
  };

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

        <HeaderIconButton title="Tìm kiếm">
          <SearchRoundedIcon />
        </HeaderIconButton>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          title={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          onClick={toggleTheme}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {themeMode === 'dark' ? <WbSunnyRoundedIcon /> : <DarkModeRoundedIcon />}
        </button>

        <button
          type="button"
          title={`${displayName} - ${displayRole}`}
          onClick={openAccountMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full p-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Avatar
            src={getMediaPreviewUrl(user?.avatar) || undefined}
            alt={displayName}
            className="!h-8 !w-8 !bg-primary !text-sm !font-bold !text-white"
          >
            {displayInitial}
          </Avatar>
        </button>

        <Menu
          anchorEl={accountAnchorEl}
          open={accountMenuOpen}
          onClose={closeAccountMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { className: 'mt-2 min-w-56 rounded-xl shadow-lg' } }}
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-slate-950">{displayName}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{displayRole}</p>
          </div>
          <MenuItem onClick={goToProfile}>
            <PersonRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Profile
          </MenuItem>
          <MenuItem onClick={handleLogout} className="text-rose-600">
            <LogoutRoundedIcon fontSize="small" className="mr-2" />
            Đăng xuất
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
}
