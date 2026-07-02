'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

const navGroups = [
  {
    label: 'Tổng quan',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: DashboardRoundedIcon },
      { href: '/users', label: 'Nhân viên', icon: PeopleAltRoundedIcon },
    ],
  },
  {
    label: 'Quản lý',
    items: [
      { href: '/customers', label: 'Khách hàng', icon: PersonSearchRoundedIcon },
      { href: '/dashboard#campaigns', label: 'Chiến dịch', icon: CampaignRoundedIcon },
      { href: '/dashboard#reports', label: 'Báo cáo', icon: AssessmentRoundedIcon },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-[88px]' : 'w-[300px]'
      }`}
    >
      <div
        className={`flex h-[72px] items-center ${collapsed ? 'justify-center px-0' : 'justify-start px-9'}`}
      >
        {collapsed ? (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white">
            X3
          </span>
        ) : (
          <Image
            src={x3salesLogo}
            alt="X3Sales logo"
            width={132}
            height={48}
            className="h-auto w-[132px]"
          />
        )}
      </div>

      <button
        type="button"
        title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        onClick={() => setCollapsed((value) => !value)}
        className="absolute right-2.5 top-[23px] inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-primary"
      >
        {collapsed ? (
          <KeyboardDoubleArrowRightRoundedIcon className="text-base" />
        ) : (
          <KeyboardDoubleArrowLeftRoundedIcon className="text-base" />
        )}
      </button>

      <div className={`z-0 flex-1 overflow-y-auto pb-2 ${collapsed ? 'px-3' : 'px-4'}`}>
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed && (
              <p className="px-3 pb-2 text-[11px] font-extrabold uppercase leading-5 text-slate-400">
                {group.label}
              </p>
            )}

            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex min-h-11 items-center rounded-lg text-sm transition ${
                      collapsed ? 'justify-center px-0' : 'justify-start px-3'
                    } ${
                      active
                        ? 'bg-primary/10 font-bold text-primary hover:bg-primary/15'
                        : 'font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center ${collapsed ? 'w-auto' : 'w-9'}`}
                    >
                      <Icon className="text-[22px]" />
                    </span>

                    {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}

                    {!collapsed && item.href.includes('#') && (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        Tạm
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}
