'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import GradingRoundedIcon from '@mui/icons-material/GradingRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import PolicyRoundedIcon from '@mui/icons-material/PolicyRounded';
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';
import { hasPermission } from '@/lib/ownership';
import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@/types/user';

const navGroups = [
  {
    label: 'CRM',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: GridViewRoundedIcon },
      { href: '/leads', label: 'Lead', icon: PersonSearchRoundedIcon, permissions: ['lead.view'] },
      {
        href: '/customers',
        label: 'Khách hàng',
        icon: GroupsRoundedIcon,
        permissions: ['customer.view'],
      },
      {
        href: '/projects',
        label: 'Dự án',
        icon: WorkspacesRoundedIcon,
        permissions: ['project.view'],
      },
      {
        href: '/quotations',
        label: 'Báo phí',
        icon: RequestQuoteRoundedIcon,
        permissions: ['quotation.view'],
      },
      { href: '/payments', label: 'Thanh toán', icon: AccountBalanceWalletRoundedIcon },
      {
        href: '/costs',
        label: 'Chi phí',
        icon: TrendingDownRoundedIcon,
        permissions: ['project.view'],
      },
      {
        href: '/weekly-reports',
        label: 'Báo cáo tuần',
        icon: CalendarMonthRoundedIcon,
        permissions: ['weeklyreport.view'],
      },
      { href: '/kpi', label: 'KPI', icon: EmojiEventsRoundedIcon, permissions: ['kpipoint.view'] },
      { href: '/media-library', label: 'Thư viện', icon: PhotoLibraryRoundedIcon },
      {
        href: '/users',
        label: 'Tài khoản',
        icon: ManageAccountsRoundedIcon,
        permissions: ['user.view', 'role.view'],
        children: [
          {
            href: '/users',
            label: 'Người dùng',
            icon: PeopleRoundedIcon,
            permissions: ['user.view'],
          },
          {
            href: '/users/departments',
            label: 'Phòng ban',
            icon: CorporateFareRoundedIcon,
            permissions: ['user.view'],
          },
          {
            href: '/users/roles',
            label: 'Vai trò',
            icon: AdminPanelSettingsRoundedIcon,
            permissions: ['role.view'],
          },
          {
            href: '/users/permissions',
            label: 'Phân quyền',
            icon: PolicyRoundedIcon,
            permissions: ['role.view'],
          },
        ],
      },
      {
        href: '/settings',
        label: 'Cài đặt',
        icon: SettingsRoundedIcon,
        permissions: ['option.manage'],
        children: [
          { href: '/projects/services', label: 'Dịch vụ', icon: DesignServicesRoundedIcon },
          { href: '/projects/partners', label: 'Đối tác', icon: HandshakeRoundedIcon },
          {
            href: '/settings/bank-accounts',
            label: 'Ngân hàng',
            icon: AccountBalanceRoundedIcon,
          },
          {
            href: '/settings/ad-topup-cards',
            label: 'Thẻ nạp QC',
            icon: CreditCardRoundedIcon,
          },
          {
            href: '/settings/kpi-categories',
            label: 'Hạng mục KPI',
            icon: GradingRoundedIcon,
          },
          { href: '/settings/options', label: 'Danh mục chung', icon: TuneRoundedIcon },
        ],
      },
    ],
  },
];

function isNavItemVisible(item: { href: string; permissions?: string[] }, user: User | null) {
  if (!item.permissions || item.permissions.length === 0) return true;

  return item.permissions.some((code) => hasPermission(user, code));
}

function getVisibleNavGroups(user: User | null) {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => isNavItemVisible(item, user))
        .map((item) =>
          'children' in item && item.children
            ? { ...item, children: item.children.filter((child) => isNavItemVisible(child, user)) }
            : item,
        ),
    }))
    .filter((group) => group.items.length > 0);
}

function isSettingsUserPath(pathname: string) {
  if (pathname === '/users' || pathname === '/users/new') return true;
  if (!pathname.startsWith('/users/')) return false;

  return ![
    '/users/departments',
    '/users/roles',
    '/users/permissions',
    '/users/role-permissions',
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href;
  if (href === '/users') return isSettingsUserPath(pathname);

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSettingsCatalogPath(pathname: string) {
  return ['/projects/services', '/projects/partners'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const currentUser = useAuthStore((state) => state.user);
  const visibleNavGroups = getVisibleNavGroups(currentUser);
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
        collapsed ? 'w-[88px]' : 'w-[250px]'
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
        aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        onClick={() => setCollapsed((value) => !value)}
        className="absolute -right-3.5 top-[22px] z-50 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm shadow-slate-200/70 transition hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20"
      >
        {collapsed ? (
          <KeyboardArrowRightRoundedIcon className="!text-[18px]" />
        ) : (
          <KeyboardArrowLeftRoundedIcon className="!text-[18px]" />
        )}
      </button>

      <div className={`z-0 flex-1 overflow-y-auto pb-2 ${collapsed ? 'px-3' : 'px-4'}`}>
        {visibleNavGroups.map((group) => (
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
                  (item.href !== '/dashboard' &&
                    pathname.startsWith(`${item.href}/`) &&
                    !(item.href === '/projects' && isSettingsCatalogPath(pathname))) ||
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
                            collapsed ? 'h-10 w-10' : 'mr-2.5 h-8 w-8'
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
                          const ChildIcon = child.icon;

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
                              <ChildIcon
                                className={`mr-2.5 !text-[18px] ${
                                  childActive ? 'text-emerald-600' : 'text-slate-400'
                                }`}
                              />
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
