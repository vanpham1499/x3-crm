'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import AnalyticsTwoToneIcon from '@mui/icons-material/AnalyticsTwoTone';
import BadgeTwoToneIcon from '@mui/icons-material/BadgeTwoTone';
import CategoryTwoToneIcon from '@mui/icons-material/CategoryTwoTone';
import DashboardTwoToneIcon from '@mui/icons-material/DashboardTwoTone';
import EventNoteTwoToneIcon from '@mui/icons-material/EventNoteTwoTone';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import PaidTwoToneIcon from '@mui/icons-material/PaidTwoTone';
import PaymentsTwoToneIcon from '@mui/icons-material/PaymentsTwoTone';
import PeopleAltTwoToneIcon from '@mui/icons-material/PeopleAltTwoTone';
import PersonSearchTwoToneIcon from '@mui/icons-material/PersonSearchTwoTone';
import ReceiptLongTwoToneIcon from '@mui/icons-material/ReceiptLongTwoTone';
import RequestQuoteTwoToneIcon from '@mui/icons-material/RequestQuoteTwoTone';
import SettingsTwoToneIcon from '@mui/icons-material/SettingsTwoTone';
import WorkTwoToneIcon from '@mui/icons-material/WorkTwoTone';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';

const navGroups = [
  {
    label: 'CRM',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: DashboardTwoToneIcon },
      { href: '/leads', label: 'Lead', icon: PersonSearchTwoToneIcon },
      { href: '/customers', label: 'Khách hàng', icon: PeopleAltTwoToneIcon },
      {
        href: '/projects',
        label: 'Dự án',
        icon: WorkTwoToneIcon,
        children: [
          { href: '/projects/services', label: 'Dịch vụ' },
          { href: '/projects/partners', label: 'Đối tác' },
        ],
      },
      { href: '/quotations', label: 'Báo giá', icon: RequestQuoteTwoToneIcon },
      { href: '/revenues', label: 'Doanh thu', icon: PaidTwoToneIcon },
      { href: '/payments', label: 'Thanh toán', icon: PaymentsTwoToneIcon },
      { href: '/invoices', label: 'Hóa đơn', icon: ReceiptLongTwoToneIcon },
      { href: '/weekly-reports', label: 'Báo cáo tuần', icon: EventNoteTwoToneIcon },
      { href: '/reports', label: 'Báo cáo', icon: AnalyticsTwoToneIcon },
      { href: '/categories', label: 'Danh mục', icon: CategoryTwoToneIcon },
      {
        href: '/users',
        label: 'Tài khoản',
        icon: BadgeTwoToneIcon,
        children: [
          { href: '/users', label: 'Người dùng' },
          { href: '/users/roles', label: 'Vai trò' },
          { href: '/users/permissions', label: 'Phân quyền' },
        ],
      },
      {
        href: '/settings',
        label: 'Cài đặt',
        icon: SettingsTwoToneIcon,
        children: [
          { href: '/settings/bank-accounts', label: 'Tài khoản nhận tiền' },
          { href: '/settings/options', label: 'Tùy chọn' },
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

            <nav className="space-y-1.5">
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
                      className={`flex min-h-11 items-center rounded-xl text-sm transition ${
                        active
                          ? 'bg-emerald-50 font-bold text-emerald-600 hover:bg-emerald-50'
                          : 'font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`group flex min-h-11 min-w-0 flex-1 items-center rounded-xl ${
                          collapsed ? 'justify-center px-0' : 'justify-start px-3'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center rounded-lg transition ${
                            collapsed ? 'h-10 w-10' : 'mr-2 h-7 w-7'
                          } ${
                            active
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-500'
                          }`}
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
                          className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/70 hover:text-emerald-600"
                        >
                          <KeyboardArrowDownRoundedIcon
                            className={`text-[20px] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                      )}
                    </div>

                    {!collapsed && hasChildren && isOpen && (
                      <div className="mb-2 ml-6 mt-1 space-y-1 border-l border-slate-200/80 pl-3">
                        {item.children?.map((child) => {
                          const childActive = isActivePath(pathname, child.href);

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`relative flex min-h-10 items-center rounded-xl px-3 text-sm transition before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-slate-200/80 ${
                                childActive
                                  ? 'bg-slate-100 font-bold text-slate-950 shadow-sm shadow-slate-200/40 hover:bg-slate-100'
                                  : 'font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                              }`}
                            >
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
