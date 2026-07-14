'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Breadcrumbs } from '@mui/material';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';

export type PageBreadcrumb = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  breadcrumbs?: PageBreadcrumb[];
  currentLabel?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  action?: {
    label: string;
    href?: string;
    icon?: ReactNode;
    disabled?: boolean;
    title?: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
  };
};

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Lead',
  customers: 'Khách hàng',
  projects: 'Dự án',
  services: 'Dịch vụ',
  partners: 'Đối tác',
  quotations: 'Báo phí',
  payments: 'Thanh toán',
  'weekly-reports': 'Báo cáo tuần',
  kpi: 'KPI',
  'kpi-categories': 'Hạng mục KPI',
  users: 'Nhân viên',
  roles: 'Vai trò',
  permissions: 'Phân quyền',
  settings: 'Cài đặt',
  'bank-accounts': 'Tài khoản nhận tiền',
  options: 'Tùy chọn',
  invoices: 'Hóa đơn',
  revenues: 'Doanh thu',
  profile: 'Hồ sơ',
  new: 'Thêm mới',
};

function isRouteIdentifier(segment: string) {
  return /^\d+$/.test(segment) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment);
}

function humanizeSegment(segment: string) {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function getRouteBreadcrumbs(pathname: string, currentLabel?: string): PageBreadcrumb[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
    return [{ label: 'Dashboard' }];
  }

  const breadcrumbs: PageBreadcrumb[] = [{ label: 'Dashboard', href: '/dashboard' }];
  let href = '';

  segments.forEach((segment, index) => {
    href += `/${segment}`;
    const isCurrent = index === segments.length - 1;
    const label =
      isCurrent && currentLabel
        ? currentLabel
        : isRouteIdentifier(segment)
          ? 'Chi tiết'
          : ROUTE_LABELS[segment] || humanizeSegment(segment);

    breadcrumbs.push({ label, href: isCurrent ? undefined : href });
  });

  return breadcrumbs;
}

export function PageHeader({
  title,
  breadcrumbs,
  currentLabel,
  eyebrow,
  actions,
  action,
}: PageHeaderProps) {
  const pathname = usePathname();
  const resolvedBreadcrumbs = breadcrumbs || getRouteBreadcrumbs(pathname, currentLabel);

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div>}
        <h1 className="mb-2 block text-2xl font-bold text-slate-950">{title}</h1>

        <Breadcrumbs
          aria-label="Điều hướng trang"
          separator={<ChevronRightRoundedIcon className="!text-[16px] text-slate-300" />}
        >
          {resolvedBreadcrumbs.map((item, index) => {
            const isCurrent = index === resolvedBreadcrumbs.length - 1;

            if (item.href && !isCurrent) {
              return (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  className="rounded text-sm font-medium text-slate-500 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <span
                key={item.label}
                aria-current={isCurrent ? 'page' : undefined}
                className="text-sm font-semibold text-slate-950"
              >
                {item.label}
              </span>
            );
          })}
        </Breadcrumbs>
      </div>

      {actions ||
        (action && (
          <PrimaryActionButton
            href={action.href}
            startIcon={action.icon}
            disabled={action.disabled}
            title={action.title}
            onClick={action.onClick}
          >
            {action.label}
          </PrimaryActionButton>
        ))}
    </header>
  );
}
