'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

const navGroups = [
  {
    label: 'CRM',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: DashboardRoundedIcon },
      { href: '/leads', label: 'Lead', icon: PersonSearchRoundedIcon },
      { href: '/customers', label: 'Khách hàng', icon: PeopleAltRoundedIcon },
      {
        href: '/projects',
        label: 'Dự án',
        icon: WorkRoundedIcon,
        children: [
          { href: '/projects/services', label: 'Dịch vụ', icon: CategoryRoundedIcon },
        ],
      },
      { href: '/revenues', label: 'Doanh thu', icon: PaidRoundedIcon },
      { href: '/payments', label: 'Thanh toán', icon: PaymentsRoundedIcon },
      { href: '/invoices', label: 'Hóa đơn', icon: ReceiptLongRoundedIcon },
      { href: '/weekly-reports', label: 'Báo cáo tuần', icon: EventNoteRoundedIcon },
      { href: '/reports', label: 'Báo cáo', icon: AssessmentRoundedIcon },
      { href: '/categories', label: 'Danh mục', icon: CategoryRoundedIcon },
      {
        href: '/users',
        label: 'Quản trị người dùng',
        icon: BadgeRoundedIcon,
        children: [
          { href: '/users', label: 'Người dùng', icon: PeopleAltRoundedIcon },
          { href: '/users/roles', label: 'Vai trò', icon: BadgeRoundedIcon },
          { href: '/users/permissions', label: 'Permission', icon: SecurityRoundedIcon },
        ],
      },
      {
        href: '/settings',
        label: 'Thiết lập hệ thống',
        icon: SettingsRoundedIcon,
        children: [
          { href: '/settings/options', label: 'Danh mục hệ thống', icon: CategoryRoundedIcon },
        ],
      },
    ],
  },
];

function isSettingsUserPath(pathname: string) {
  if (pathname === '/users' || pathname === '/users/new') return true;
  if (!pathname.startsWith('/users/')) return false;

  return !['/users/roles', '/users/permissions', '/users/role-permissions'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href;
  if (href === '/users') return isSettingsUserPath(pathname);

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openNavItems, setOpenNavItems] = useState<Record<string, boolean>>({});

  const toggleNavItem = (href: string, defaultOpen: boolean) => {
    setOpenNavItems((current) => ({
      ...current,
      [href]: !(current[href] ?? defaultOpen),
    }));
  };

  return (
    <aside
      className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-[88px]' : 'w-[300px]'
      }`}
    >
      <div
        className={`flex h-[72px] items-center ${collapsed ? 'justify-center px-0' : 'justify-start px-6'}`}
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
        className="absolute -right-3 top-1/2 z-50 inline-flex h-6 w-6 -translate-y-1/2 top-[32px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500  shadow-slate-200/70 transition hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20"
      >
        {collapsed ? (
          <KeyboardArrowRightRoundedIcon className="text-base text-xs" />
        ) : (
          <KeyboardArrowLeftRoundedIcon className="text-base text-xs" />
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
                const hasChildren = Boolean(item.children?.length);
                const childActive = Boolean(
                  item.children?.some((child) => isActivePath(pathname, child.href)),
                );
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)) ||
                  childActive;
                const isOpen = openNavItems[item.href] ?? active;

                return (
                  <div key={item.href}>
                    <div
                      className={`flex min-h-11 items-center rounded-lg text-sm transition ${
                        active
                          ? 'bg-primary/10 font-bold text-primary hover:bg-primary/15'
                          : 'font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex min-h-11 min-w-0 flex-1 items-center rounded-lg ${
                          collapsed ? 'justify-center px-0' : 'justify-start px-3'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center ${collapsed ? 'w-auto' : 'w-9'}`}
                        >
                          <Icon className="text-[22px]" />
                        </span>

                        {!collapsed && (
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        )}

                        {!collapsed && item.href.includes('#') && (
                          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                            Tạm
                          </span>
                        )}
                      </Link>

                      {!collapsed && hasChildren && (
                        <button
                          type="button"
                          aria-label={isOpen ? `Thu gọn ${item.label}` : `Mở rộng ${item.label}`}
                          aria-expanded={isOpen}
                          onClick={() => toggleNavItem(item.href, active)}
                          className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/70 hover:text-primary"
                        >
                          <KeyboardArrowDownRoundedIcon
                            className={`text-[20px] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                      )}
                    </div>

                    {!collapsed && hasChildren && isOpen && (
                      <div className="mt-1 space-y-1 pl-2">
                        {item.children?.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = isActivePath(pathname, child.href);

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`flex min-h-9 items-center rounded-lg px-3 text-sm transition ${
                                childActive
                                  ? 'bg-primary/10 font-bold text-primary hover:bg-primary/15'
                                  : 'font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                              }`}
                            >
                              <span className="inline-flex w-8 items-center justify-center">
                                <ChildIcon className="text-[19px]" />
                              </span>
                              <span className="min-w-0 flex-1 truncate">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}
