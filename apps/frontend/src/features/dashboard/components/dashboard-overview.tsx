'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import RoomServiceRoundedIcon from '@mui/icons-material/RoomServiceRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { LinearProgress } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { ChartsContainer } from '@mui/x-charts/ChartsContainer';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { LinePlot } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { ServiceTableCell } from '@/components/table/service-table-cell';
import { siteConfig } from '@/config/site';
import { formatCurrency } from '@/lib/utils';
import type {
  DashboardDepartmentRow,
  DashboardEmployeeRow,
  DashboardPeriodFilters,
  DashboardProjectStatus,
  DashboardReport,
  DashboardServiceRow,
} from '@/types/dashboard';
import { DashboardPeriodFilterBar } from './dashboard-period-filters';

type DashboardOverviewProps = {
  report: DashboardReport;
  filters: DashboardPeriodFilters;
  isFetching: boolean;
  onFiltersChange: (filters: DashboardPeriodFilters) => void;
};

const integerFormatter = new Intl.NumberFormat('vi-VN');
const compactNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const PRIMARY_COLOR = siteConfig.brand.primary;
const PRIMARY_DARK_COLOR = siteConfig.brand.secondary;
const BRAND_BLUE_COLOR = siteConfig.brand.blue;
const ERROR_COLOR = '#e11d48';
const MUTED_COLOR = '#94a3b8';

function formatCompactMoney(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absolute >= 1_000_000_000) {
    return `${sign}${compactNumber.format(absolute / 1_000_000_000)} tỷ`;
  }

  if (absolute >= 1_000_000) {
    return `${sign}${compactNumber.format(absolute / 1_000_000)} tr`;
  }

  if (absolute >= 1_000) {
    return `${sign}${compactNumber.format(absolute / 1_000)} nghìn`;
  }

  return `${compactNumber.format(value)} đ`;
}

function formatPercent(value: number | null) {
  if (value === null) return 'Chưa có kế hoạch';

  return `${compactNumber.format(value)}%`;
}

function amountTone(value: number) {
  return value < 0 ? 'text-rose-700' : 'text-primary';
}

function changeText(value: number | null) {
  if (value === null) return 'Kỳ trước chưa phát sinh';
  if (Math.abs(value) < 0.005) return 'Không đổi so với kỳ trước';

  return `${value > 0 ? '+' : '-'}${compactNumber.format(Math.abs(value))}% so với kỳ trước`;
}

function formatPeriodLabel(periodFrom: string, periodTo: string) {
  const monthLabel = (period: string) => {
    const [year, month] = period.split('-');

    return `${month}/${year}`;
  };

  return periodFrom === periodTo
    ? `Tháng ${monthLabel(periodFrom)}`
    : `${monthLabel(periodFrom)} – ${monthLabel(periodTo)}`;
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="grid h-full min-h-44 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}

function ChangeBadge({ value }: { value: number | null }) {
  const isPositive = value !== null && value > 0;
  const isNegative = value !== null && value < 0;

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
        isPositive
          ? 'bg-primary/10 text-primary'
          : isNegative
            ? 'bg-rose-50 text-rose-700'
            : 'bg-slate-100 text-slate-500'
      }`}
    >
      {changeText(value)}
    </span>
  );
}

function OperationMetricCard({
  label,
  value,
  helper,
  change,
  href,
  icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  change?: number | null;
  href: string;
  icon: React.ReactNode;
  tone: 'primary' | 'brand';
}) {
  const tones = {
    primary: {
      shell: 'from-primary/10 via-white to-white',
      icon: 'bg-primary text-primary-foreground shadow-emerald-200',
      accent: 'bg-primary',
    },
    brand: {
      shell: 'from-brand-blue/10 via-white to-white',
      icon: 'bg-brand-blue text-white shadow-sky-200',
      accent: 'bg-brand-blue',
    },
  }[tone];

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br ${tones.shell} p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]`}
    >
      <span className={`absolute inset-x-0 top-0 h-0.5 ${tones.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-[28px] font-black leading-none tabular-nums text-slate-950">
            {value}
          </p>
        </div>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl shadow-lg ${tones.icon} [&>svg]:!text-[21px]`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-4 flex min-h-7 items-end justify-between gap-2">
        <p className="line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{helper}</p>
        {change !== undefined && <ChangeBadge value={change} />}
      </div>
    </Link>
  );
}

function CrmFlowCard({ report }: { report: DashboardReport }) {
  const { leads, customers, projects } = report.operations;
  const stages = [
    {
      label: 'Lead phát sinh',
      value: leads.newCount,
      helper: `${integerFormatter.format(leads.openCount)} lead chưa chuyển khách`,
      color: 'bg-primary',
    },
    {
      label: 'Lead đã chuyển khách',
      value: leads.convertedFromNewCount,
      helper:
        leads.conversionRate === null
          ? 'Chưa có lead trong kỳ'
          : `${compactNumber.format(leads.conversionRate)}% lead phát sinh trong kỳ`,
      color: 'bg-brand-blue',
    },
    {
      label: 'Khách hàng mới',
      value: customers.newCount,
      helper: `${integerFormatter.format(customers.totalCount)} khách hàng đang quản lý`,
      color: 'bg-primary',
    },
    {
      label: 'Dự án mới',
      value: projects.newCount,
      helper: `${integerFormatter.format(projects.totalCount)} dự án đang quản lý`,
      color: 'bg-brand-blue',
    },
  ];
  const maxValue = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] xl:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
            Luồng CRM
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Nhịp vận hành trong kỳ</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Theo dõi các mốc chính từ lead đến dự án
          </p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <InsightsRoundedIcon className="!text-[22px]" />
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {stages.map((stage, index) => (
          <div key={stage.label} className="relative min-w-0">
            <div className="rounded-2xl bg-slate-50/90 p-4 ring-1 ring-inset ring-slate-100">
              <div className="flex items-center justify-between gap-2">
                <span className={`size-2.5 rounded-full ${stage.color}`} />
                {index < stages.length - 1 && (
                  <ArrowForwardRoundedIcon className="hidden !text-[18px] text-slate-300 md:block" />
                )}
              </div>
              <p className="mt-4 text-2xl font-black tabular-nums text-slate-950">
                {integerFormatter.format(stage.value)}
              </p>
              <p className="mt-1 text-sm font-extrabold text-slate-800">{stage.label}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                <div
                  className={`h-full rounded-full ${stage.color}`}
                  style={{ width: `${Math.max(5, (stage.value / maxValue) * 100)}%` }}
                />
              </div>
              <p className="mt-2 line-clamp-2 min-h-9 text-xs font-semibold leading-[18px] text-slate-500">
                {stage.helper}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AttentionItem({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'primary' | 'brand' | 'amber' | 'rose';
}) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    primary: 'bg-primary/10 text-primary',
    brand: 'bg-brand-blue/10 text-brand-blue',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <span
        className={`min-w-9 rounded-lg px-2.5 py-1 text-center text-sm font-black tabular-nums ${colors}`}
      >
        {integerFormatter.format(value)}
      </span>
    </div>
  );
}

function AttentionBoard({ report }: { report: DashboardReport }) {
  const meetings = report.operations.meetings;
  const weeklyReports = report.operations.weeklyReports;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 border-t-4 border-t-primary bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="px-5 pb-4 pt-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">Cần chú ý</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">Công việc hiện tại</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Lịch hôm nay và tiến độ báo cáo tuần
        </p>
      </div>

      <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <Link
          href="/meetings"
          className="group bg-white px-5 py-4 transition-colors duration-200 hover:bg-primary/5"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <CalendarMonthRoundedIcon className="!text-[20px] text-primary" />
              Lịch hẹn
            </span>
            <ArrowForwardRoundedIcon className="!text-[18px] text-primary transition group-hover:translate-x-0.5" />
          </div>
          {meetings ? (
            <div className="mt-3 divide-y divide-slate-100">
              <AttentionItem label="Hôm nay" value={meetings.today} tone="primary" />
              <AttentionItem label="Sắp tới 7 ngày" value={meetings.upcoming} tone="slate" />
              <AttentionItem label="Quá hạn" value={meetings.overdue} tone="rose" />
            </div>
          ) : (
            <p className="mt-5 text-xs font-semibold text-slate-500">Không có quyền xem lịch hẹn</p>
          )}
        </Link>

        <Link
          href="/weekly-reports"
          className="group bg-white px-5 py-4 transition-colors duration-200 hover:bg-primary/5"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <ReceiptLongRoundedIcon className="!text-[20px] text-brand-blue" />
              Báo cáo tuần
            </span>
            <ArrowForwardRoundedIcon className="!text-[18px] text-primary transition group-hover:translate-x-0.5" />
          </div>
          {weeklyReports ? (
            <div className="mt-3 divide-y divide-slate-100">
              <AttentionItem label="Đến hạn hôm nay" value={weeklyReports.dueToday} tone="amber" />
              <AttentionItem label="Quá hạn" value={weeklyReports.overdue} tone="rose" />
              <AttentionItem label="Chờ duyệt" value={weeklyReports.waitingApproval} tone="brand" />
            </div>
          ) : (
            <p className="mt-5 text-xs font-semibold text-slate-500">
              Không có quyền xem báo cáo tuần
            </p>
          )}
        </Link>
      </div>
    </section>
  );
}

function projectStatusChartRows(statuses: DashboardProjectStatus[]) {
  const sorted = [...statuses].sort((left, right) => right.count - left.count);

  if (sorted.length <= 6) return sorted;

  return [
    ...sorted.slice(0, 5),
    {
      id: -1,
      key: 'other',
      label: 'Trạng thái khác',
      color: '#94a3b8',
      count: sorted.slice(5).reduce((total, row) => total + row.count, 0),
    },
  ];
}

function ProjectPortfolio({
  report,
  subtitle = 'Tỷ trọng toàn bộ dự án đang tồn tại',
}: {
  report: DashboardReport;
  subtitle?: string;
}) {
  const data = projectStatusChartRows(report.operations.projects.statuses);
  const total = report.operations.projects.totalCount;
  const unclassifiedCount =
    report.operations.projects.statuses.find((row) => row.id === 0)?.count ?? 0;
  const classifiedCount = Math.max(0, total - unclassifiedCount);
  const classificationData = [
    {
      id: 'classified',
      label: 'Đã phân loại',
      value: classifiedCount,
      color: PRIMARY_COLOR,
    },
    ...(unclassifiedCount > 0
      ? [
          {
            id: 'unclassified',
            label: 'Chưa phân loại',
            value: unclassifiedCount,
            color: MUTED_COLOR,
          },
        ]
      : []),
  ];

  return (
    <section className="flex h-full min-h-[500px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] xl:p-6">
      <div className="flex min-h-[64px] items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
            Danh mục dự án
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Phân bổ theo trạng thái</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
        </div>
        <Link
          href="/projects"
          className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-primary/10 px-3 text-xs font-extrabold text-primary transition-colors duration-200 hover:bg-primary/15"
        >
          Xem dự án
          <ArrowForwardRoundedIcon className="!text-[17px]" />
        </Link>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center justify-center">
        <div className="relative mx-auto h-[300px] w-full max-w-[360px]">
          {data.length === 0 ? (
            <EmptyChart text="Chưa có dự án" />
          ) : (
            <>
              <PieChart
                height={300}
                hideLegend
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                series={[
                  {
                    id: 'project-classification',
                    data: classificationData,
                    innerRadius: '33%',
                    outerRadius: '56%',
                    paddingAngle: 2,
                    cornerRadius: 4,
                    valueFormatter: (item) => `${integerFormatter.format(item.value)} dự án`,
                  },
                  {
                    id: 'project-statuses',
                    data: data.map((row) => ({
                      id: row.id,
                      label: row.label,
                      value: row.count,
                      color: row.color,
                    })),
                    innerRadius: '60%',
                    outerRadius: '88%',
                    paddingAngle: 2,
                    cornerRadius: 4,
                    valueFormatter: (item) => `${integerFormatter.format(item.value)} dự án`,
                  },
                ]}
              />
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <span className="text-[28px] font-black leading-none tabular-nums text-slate-950">
                  {integerFormatter.format(total)}
                </span>
                <span className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  Dự án
                </span>
              </div>
            </>
          )}
        </div>

        <div className="mt-2 grid w-full gap-2 sm:grid-cols-2">
          {data.map((row) => {
            const percentage = total > 0 ? (row.count / total) * 100 : 0;

            return (
              <div
                key={row.id}
                className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3 transition-colors duration-200 hover:border-primary/20 hover:bg-primary/5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-slate-700">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate" title={row.label}>
                      {row.label}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-black tabular-nums text-slate-950">
                    {integerFormatter.format(row.count)} · {compactNumber.format(percentage)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinanceMetric({
  label,
  value,
  helper,
  icon,
  valueClassName = 'text-slate-950',
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary [&>svg]:!text-[18px]">
          {icon}
        </span>
        {label}
      </div>
      <p
        className={`mt-3 truncate text-2xl font-black tabular-nums ${valueClassName}`}
        title={value}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-500" title={helper}>
        {helper}
      </p>
    </div>
  );
}

function CashTrendChart({ report }: { report: DashboardReport }) {
  const data = report.trend.points;
  const hasData = data.some(
    (point) =>
      point.quotationAmount !== 0 || point.receivedAmount !== 0 || point.refundAmount !== 0,
  );
  const tickStep = Math.max(1, Math.ceil(data.length / 12));
  const chartTitle =
    report.trend.granularity === 'day' ? 'Dòng tiền từng ngày' : 'Dòng tiền từng tháng';

  return (
    <section className="flex h-full min-h-[500px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] xl:p-6">
      <div className="flex min-h-[64px] flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
            Dòng tiền
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{chartTitle}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Lũy kế Báo phí gồm VAT và cọc, Đã thu, Hoàn tiền và Thu ròng
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-[11px] font-extrabold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-brand-blue" /> Báo phí
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-primary" /> Đã thu
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 border-t-2 border-dashed border-rose-500" /> Hoàn tiền
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-slate-800" /> Thu ròng
          </span>
        </div>
      </div>

      <div className="mt-4 h-[330px] rounded-2xl border border-slate-200 bg-slate-50/80">
        {!hasData ? (
          <EmptyChart text="Chưa có Báo phí, giao dịch thu hoặc hoàn tiền trong kỳ đã chọn" />
        ) : (
          <ChartsContainer
            height={328}
            margin={{ top: 8, right: 10, bottom: 4, left: 4 }}
            series={[
              {
                id: 'quotation',
                type: 'line',
                label: 'Báo phí',
                data: data.map((point) => point.cumulativeQuotationAmount),
                color: BRAND_BLUE_COLOR,
                curve: 'monotoneX',
                showMark: false,
                valueFormatter: (value) => (value === null ? '' : formatCurrency(value)),
              },
              {
                id: 'received',
                type: 'line',
                label: 'Đã thu',
                data: data.map((point) => point.cumulativeReceivedAmount),
                color: PRIMARY_COLOR,
                curve: 'monotoneX',
                showMark: false,
                valueFormatter: (value) => (value === null ? '' : formatCurrency(value)),
              },
              {
                id: 'refund',
                type: 'line',
                label: 'Hoàn tiền',
                data: data.map((point) => point.cumulativeRefundAmount),
                color: ERROR_COLOR,
                curve: 'monotoneX',
                showMark: false,
                valueFormatter: (value) => (value === null ? '' : formatCurrency(value)),
              },
              {
                id: 'net',
                type: 'line',
                label: 'Thu ròng',
                data: data.map((point) => point.cumulativeNetAmount),
                color: '#1e293b',
                curve: 'monotoneX',
                showMark: false,
                valueFormatter: (value) => (value === null ? '' : formatCurrency(value)),
              },
            ]}
            xAxis={[
              {
                id: 'period',
                scaleType: 'point',
                data: data.map((point) => point.label),
                tickLabelInterval: (_value, index) =>
                  index % tickStep === 0 || index === data.length - 1,
                height: 28,
                tickLabelStyle: { fill: '#64748b', fontSize: 11, fontWeight: 700 },
              },
            ]}
            yAxis={[
              {
                id: 'money',
                width: 54,
                valueFormatter: (value) => formatCompactMoney(Number(value)),
                tickLabelStyle: { fill: '#64748b', fontSize: 11, fontWeight: 700 },
              },
            ]}
            sx={{
              '& .MuiChartsGrid-line': {
                stroke: '#d9e1ea',
              },
              '& .MuiLineElement-root[data-series="quotation"]': {
                strokeWidth: 2.5,
              },
              '& .MuiLineElement-root[data-series="received"]': {
                strokeWidth: 2.5,
              },
              '& .MuiLineElement-root[data-series="refund"]': {
                strokeDasharray: '6 5',
                strokeWidth: 2.5,
              },
              '& .MuiLineElement-root[data-series="net"]': {
                strokeWidth: 3,
              },
            }}
          >
            <ChartsGrid horizontal vertical />
            <LinePlot />
            <ChartsXAxis axisId="period" disableTicks />
            <ChartsYAxis axisId="money" disableTicks />
            <ChartsTooltip trigger="axis" />
          </ChartsContainer>
        )}
      </div>
    </section>
  );
}

function ProfitTargetCard({ report }: { report: DashboardReport }) {
  const { profitAmount, targetAmount, completionRate } = report.summary;
  const topServices = [...report.services]
    .filter((row) => row.actualAmount !== 0 || row.targetAmount !== 0)
    .sort(
      (left, right) =>
        Math.max(right.actualAmount, right.targetAmount) -
        Math.max(left.actualAmount, left.targetAmount),
    )
    .slice(0, 4);
  const completionAxisMax = Math.max(
    100,
    ...topServices.map((row) => Math.max(0, row.completionRate ?? 0)),
  );

  return (
    <section className="flex h-full min-h-[500px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] xl:p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
        Hiệu quả KPI
      </p>
      <h2 className="mt-1 text-lg font-black text-slate-950">So sánh theo dịch vụ</h2>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-primary/5 px-3 py-3">
          <p className="text-[11px] font-bold text-slate-500">Lợi nhuận trước VAT</p>
          <p
            className={`mt-1 truncate text-sm font-black tabular-nums ${amountTone(profitAmount)}`}
            title={formatCurrency(profitAmount)}
          >
            {formatCompactMoney(profitAmount)}
          </p>
        </div>
        <div className="rounded-xl bg-brand-blue/5 px-3 py-3">
          <p className="text-[11px] font-bold text-slate-500">Kế hoạch</p>
          <p
            className="mt-1 truncate text-sm font-black tabular-nums text-brand-blue"
            title={formatCurrency(targetAmount)}
          >
            {formatCompactMoney(targetAmount)}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-3">
          <p className="text-[11px] font-bold text-slate-500">Hoàn thành</p>
          <p className="mt-1 truncate text-sm font-black tabular-nums text-amber-700">
            {formatPercent(completionRate)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-extrabold text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" /> Lợi nhuận
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-blue" /> Kế hoạch
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-500" /> Hoàn thành
        </span>
      </div>

      <div className="mt-2 min-h-[300px] flex-1">
        {topServices.length === 0 ? (
          <EmptyChart text="Chưa có lợi nhuận hoặc kế hoạch dịch vụ trong kỳ" />
        ) : (
          <BarChart
            height={310}
            hideLegend
            borderRadius={5}
            grid={{ horizontal: true }}
            margin={{ top: 8, right: 4, bottom: 4, left: 4 }}
            dataset={topServices.map((row) => ({
              label: row.code || row.name,
              profit: row.actualAmount,
              target: row.targetAmount,
              completion: row.completionRate ?? 0,
            }))}
            xAxis={[
              {
                id: 'service',
                scaleType: 'band',
                dataKey: 'label',
                height: 32,
                tickLabelStyle: { fill: '#475569', fontSize: 10, fontWeight: 800 },
              },
            ]}
            yAxis={[
              {
                id: 'money',
                position: 'left',
                width: 50,
                valueFormatter: (value) => formatCompactMoney(Number(value)),
                tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
              },
              {
                id: 'completion',
                position: 'right',
                width: 38,
                min: 0,
                max: completionAxisMax,
                valueFormatter: (value) => `${compactNumber.format(Number(value))}%`,
                tickLabelStyle: { fill: '#b45309', fontSize: 10, fontWeight: 700 },
              },
            ]}
            series={[
              {
                dataKey: 'profit',
                label: 'Lợi nhuận trước VAT',
                yAxisId: 'money',
                color: PRIMARY_COLOR,
                colorGetter: ({ value }) =>
                  value !== null && value < 0 ? ERROR_COLOR : PRIMARY_COLOR,
                valueFormatter: (value) => (value === null ? '' : formatCurrency(value)),
              },
              {
                dataKey: 'target',
                label: 'Kế hoạch',
                yAxisId: 'money',
                color: BRAND_BLUE_COLOR,
                valueFormatter: (value) => (value === null ? '' : formatCurrency(value)),
              },
              {
                dataKey: 'completion',
                label: 'Hoàn thành',
                yAxisId: 'completion',
                color: '#f59e0b',
                valueFormatter: (value) =>
                  value === null ? '' : `${compactNumber.format(value)}%`,
              },
            ]}
            sx={{
              '& .MuiChartsGrid-line': {
                stroke: '#e2e8f0',
              },
            }}
          />
        )}
      </div>
    </section>
  );
}

function CompletionCell({ value }: { value: number | null }) {
  const progress = value === null ? 0 : Math.min(100, Math.max(0, value));
  const color =
    value === null
      ? MUTED_COLOR
      : value < 0
        ? '#be123c'
        : value >= 100
          ? PRIMARY_DARK_COLOR
          : PRIMARY_COLOR;

  return (
    <div className="ml-auto w-28">
      <span
        className={`block text-right text-xs font-extrabold tabular-nums ${
          value === null
            ? 'text-slate-500'
            : value < 0
              ? 'text-rose-700'
              : value >= 100
                ? 'text-primary'
                : 'text-primary'
        }`}
      >
        {formatPercent(value)}
      </span>
      <LinearProgress
        variant="determinate"
        value={progress}
        className="mt-1.5 !h-1.5 !rounded-full !bg-slate-100"
        sx={{ '& .MuiLinearProgress-bar': { borderRadius: 999, backgroundColor: color } }}
      />
    </div>
  );
}

function ServiceDashboard({
  rows,
  isFetching,
}: {
  rows: DashboardServiceRow[];
  isFetching: boolean;
}) {
  return (
    <AppDataTable
      columns={[
        { key: 'service', label: 'Dịch vụ', className: 'w-[210px]' },
        { key: 'profit', label: 'Lợi nhuận trước VAT', className: 'w-[170px] text-right' },
        { key: 'target', label: 'Kế hoạch', className: 'w-[145px] text-right' },
        { key: 'completion', label: 'Hoàn thành', className: 'w-[135px] text-right' },
      ]}
      isLoading={isFetching}
      isEmpty={rows.length === 0}
      emptyText="Chưa có dữ liệu dịch vụ trong kỳ đã chọn"
      minWidthClassName="min-w-[660px]"
    >
      {rows.map((row) => (
        <tr key={row.id} className="hover:bg-slate-50/80">
          <td className="px-3 py-4">
            <ServiceTableCell
              code={row.code}
              name={`${row.name}${
                row.isDeleted ? ' (Đã xóa)' : row.isActive ? '' : ' (Ngừng hoạt động)'
              }`}
            />
          </td>
          <td
            className={`whitespace-nowrap px-3 py-4 text-right font-extrabold tabular-nums ${amountTone(row.actualAmount)}`}
          >
            {formatCurrency(row.actualAmount)}
          </td>
          <td className="whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums text-slate-800">
            {formatCurrency(row.targetAmount)}
          </td>
          <td className="px-3 py-4">
            <CompletionCell value={row.completionRate} />
          </td>
        </tr>
      ))}
    </AppDataTable>
  );
}

function DepartmentDashboard({
  rows,
  isFetching,
}: {
  rows: DashboardDepartmentRow[];
  isFetching: boolean;
}) {
  return (
    <AppDataTable
      columns={[
        { key: 'department', label: 'Phòng ban', className: 'w-[210px]' },
        { key: 'actual', label: 'Lợi nhuận trước VAT', className: 'w-[170px] text-right' },
        { key: 'target', label: 'Kế hoạch', className: 'w-[145px] text-right' },
        { key: 'completion', label: 'Hoàn thành', className: 'w-[135px] text-right' },
      ]}
      isLoading={isFetching}
      isEmpty={rows.length === 0}
      emptyText="Chưa có phòng ban để tổng hợp Dashboard"
      minWidthClassName="min-w-[660px]"
    >
      {rows.map((row) => (
        <tr key={row.id} className="hover:bg-slate-50/80">
          <td className="px-3 py-4">
            <span className="flex min-w-0 items-center gap-2 font-bold text-slate-950">
              <CorporateFareRoundedIcon className="!text-[19px] text-primary" />
              <span className="truncate" title={row.name}>
                {row.name}
              </span>
            </span>
          </td>
          <td
            className={`whitespace-nowrap px-3 py-4 text-right font-extrabold tabular-nums ${amountTone(row.actualAmount)}`}
          >
            {formatCurrency(row.actualAmount)}
          </td>
          <td className="whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums text-slate-800">
            {formatCurrency(row.targetAmount)}
          </td>
          <td className="px-3 py-4">
            <CompletionCell value={row.completionRate} />
          </td>
        </tr>
      ))}
    </AppDataTable>
  );
}

function ScopedMetricCard({
  label,
  value,
  helper,
  icon,
  change,
  tone = 'primary',
  valueClassName = 'text-slate-950',
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  change?: number | null;
  tone?: 'primary' | 'brand';
  valueClassName?: string;
}) {
  const accent = tone === 'brand' ? 'bg-brand-blue' : 'bg-primary';
  const iconTone =
    tone === 'brand' ? 'bg-brand-blue/10 text-brand-blue' : 'bg-primary/10 text-primary';

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.11em] text-slate-500">
            {label}
          </p>
          <p
            className={`mt-2 truncate text-[26px] font-black leading-none tabular-nums ${valueClassName}`}
            title={value}
          >
            {value}
          </p>
        </div>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconTone} [&>svg]:!text-[21px]`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-4 flex min-h-7 items-end justify-between gap-2">
        <p className="line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{helper}</p>
        {change !== undefined && <ChangeBadge value={change} />}
      </div>
    </section>
  );
}

function ScopedProfitTrendChart({ report }: { report: DashboardReport }) {
  const trend = report.profitTrend;
  const data = trend?.points ?? [];
  const hasData = data.some(
    (point) => point.profitAmount !== 0 || point.previousProfitAmount !== 0,
  );
  const tickStep = Math.max(1, Math.ceil(data.length / 12));
  const comparisonLabel = formatPeriodLabel(
    report.comparison.periodFrom,
    report.comparison.periodTo,
  );
  const title = trend?.granularity === 'month' ? 'Lợi nhuận từng tháng' : 'Lợi nhuận từng ngày';

  return (
    <section className="flex h-full min-h-[500px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] xl:p-6">
      <div className="flex min-h-[64px] flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
            Hiệu quả theo thời gian
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Lợi nhuận trước VAT phát sinh trong từng mốc thời gian
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-[11px] font-extrabold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-primary" /> Kỳ đang xem
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-brand-blue opacity-55" /> {comparisonLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 h-[330px] rounded-2xl border border-slate-200 bg-slate-50/80">
        {!trend || !hasData ? (
          <EmptyChart text="Chưa có lợi nhuận phát sinh trong kỳ hoặc kỳ so sánh" />
        ) : (
          <ChartsContainer
            height={328}
            margin={{ top: 10, right: 10, bottom: 4, left: 4 }}
            series={[
              {
                id: 'current-profit',
                type: 'line',
                label: 'Kỳ đang xem',
                data: data.map((point) => point.profitAmount),
                color: PRIMARY_COLOR,
                curve: 'monotoneX',
                showMark: data.length <= 12,
                valueFormatter: (value) => (value === null ? '' : formatCurrency(value)),
              },
              {
                id: 'previous-profit',
                type: 'line',
                label: comparisonLabel,
                data: data.map((point) => point.previousProfitAmount),
                color: BRAND_BLUE_COLOR,
                curve: 'monotoneX',
                showMark: false,
                valueFormatter: (value) => (value === null ? '' : formatCurrency(value)),
              },
            ]}
            xAxis={[
              {
                id: 'period',
                scaleType: 'point',
                data: data.map((point) => point.label),
                tickLabelInterval: (_value, index) =>
                  index % tickStep === 0 || index === data.length - 1,
                height: 28,
                tickLabelStyle: { fill: '#64748b', fontSize: 11, fontWeight: 700 },
              },
            ]}
            yAxis={[
              {
                id: 'profit',
                width: 54,
                valueFormatter: (value) => formatCompactMoney(Number(value)),
                tickLabelStyle: { fill: '#64748b', fontSize: 11, fontWeight: 700 },
              },
            ]}
            sx={{
              '& .MuiChartsGrid-line': { stroke: '#d9e1ea' },
              '& .MuiLineElement-root[data-series="current-profit"]': { strokeWidth: 3 },
              '& .MuiLineElement-root[data-series="previous-profit"]': {
                opacity: 0.55,
                strokeWidth: 2.5,
              },
            }}
          >
            <ChartsGrid horizontal vertical />
            <LinePlot />
            <ChartsXAxis axisId="period" disableTicks />
            <ChartsYAxis axisId="profit" disableTicks />
            <ChartsTooltip trigger="axis" />
          </ChartsContainer>
        )}
      </div>
    </section>
  );
}

function EmployeePerformanceCard({
  rows,
  isFetching,
}: {
  rows: DashboardEmployeeRow[];
  isFetching: boolean;
}) {
  return (
    <section className="h-full min-h-[500px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-200 px-5 py-5 xl:px-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
          Hiệu quả nhân sự
        </p>
        <h2 className="mt-1 text-lg font-black text-slate-950">Kết quả trong phòng ban</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Lợi nhuận và trạng thái dự án do từng nhân sự triển khai
        </p>
      </div>
      <div className="max-h-[408px] overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
        <AppDataTable
          columns={[
            { key: 'employee', label: 'Nhân sự', className: 'w-[190px]' },
            { key: 'profit', label: 'Lợi nhuận', className: 'w-[150px] text-right' },
            { key: 'active', label: 'Active', className: 'w-[80px] text-center' },
            { key: 'pause', label: 'Pause', className: 'w-[80px] text-center' },
            { key: 'stopped', label: 'Dừng', className: 'w-[80px] text-center' },
            { key: 'projects', label: 'Tổng DA', className: 'w-[85px] text-center' },
          ]}
          isLoading={isFetching}
          isEmpty={rows.length === 0}
          emptyText="Chưa có nhân sự thuộc phòng ban để tổng hợp"
          minWidthClassName="min-w-[700px]"
        >
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/80">
              <td className="px-3 py-4">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-black text-primary">
                    {row.name.trim().charAt(0).toUpperCase() || 'N'}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-slate-900">
                      {row.name}
                    </span>
                    <span className="block truncate text-[11px] font-semibold text-slate-500">
                      {row.code || 'Chưa có mã'}
                    </span>
                  </span>
                </span>
              </td>
              <td
                className={`whitespace-nowrap px-3 py-4 text-right text-sm font-black tabular-nums ${amountTone(row.actualAmount)}`}
              >
                {formatCurrency(row.actualAmount)}
              </td>
              <td className="px-3 py-4 text-center">
                <span className="inline-flex min-w-7 justify-center rounded-lg bg-primary/10 px-2 py-1 text-xs font-black text-primary">
                  {row.activeProjectCount}
                </span>
              </td>
              <td className="px-3 py-4 text-center">
                <span className="inline-flex min-w-7 justify-center rounded-lg bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                  {row.pausedProjectCount}
                </span>
              </td>
              <td className="px-3 py-4 text-center">
                <span className="inline-flex min-w-7 justify-center rounded-lg bg-rose-50 px-2 py-1 text-xs font-black text-rose-700">
                  {row.stoppedProjectCount}
                </span>
              </td>
              <td className="px-3 py-4 text-center text-sm font-black tabular-nums text-slate-900">
                {row.projectCount}
              </td>
            </tr>
          ))}
        </AppDataTable>
      </div>
    </section>
  );
}

function PersonalContributionCard({ row }: { row?: DashboardEmployeeRow }) {
  const items = [
    {
      label: 'Triển khai dự án',
      value: row?.implementationAmount ?? 0,
      helper: 'Tiền thu trước VAT − chi phí − hoàn tiền',
      icon: <CorporateFareRoundedIcon />,
    },
    {
      label: 'Phụ trách khách hàng',
      value: row?.acquisitionAmount ?? 0,
      helper: 'Báo phí thanh toán thành công đầu tiên và hoàn tiền',
      icon: <PeopleAltRoundedIcon />,
    },
  ];

  return (
    <section className="flex h-full min-h-[500px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] xl:p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
        Cơ cấu lợi nhuận
      </p>
      <h2 className="mt-1 text-lg font-black text-slate-950">Đóng góp của tôi</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        Hai vai trò được cộng dồn nếu bạn vừa triển khai vừa phụ trách khách hàng
      </p>

      <div className="mt-5 grid flex-1 content-center gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                  {item.label}
                </p>
                <p
                  className={`mt-2 truncate text-2xl font-black tabular-nums ${amountTone(item.value)}`}
                  title={formatCurrency(item.value)}
                >
                  {formatCompactMoney(item.value)}
                </p>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:!text-[20px]">
                {item.icon}
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{item.helper}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScopedDashboardOverview({
  report,
  filters,
  isFetching,
  onFiltersChange,
}: DashboardOverviewProps) {
  const comparisonLabel = formatPeriodLabel(
    report.comparison.periodFrom,
    report.comparison.periodTo,
  );
  const isDepartment = report.scope.level === 'department';
  const subjectLabel = isDepartment
    ? report.scope.departmentName || report.scope.label
    : report.scope.userName;
  const employee = report.employees[0];
  const completionHelper = isDepartment
    ? 'Lợi nhuận TEAM / kế hoạch phòng ban'
    : 'Lợi nhuận cá nhân / kế hoạch phòng ban';

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-[#f6f8fc] p-4 sm:p-6">
      <PageHeader
        title="Dashboard"
        actions={
          <DashboardPeriodFilterBar
            filters={filters}
            comparisonLabel={comparisonLabel}
            onChange={onFiltersChange}
          />
        }
      />

      <div className="-mt-3 mb-4 h-1 overflow-hidden rounded-full">
        {isFetching && <LinearProgress color="primary" />}
      </div>

      <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/10 via-white to-brand-blue/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-lg shadow-emerald-200/60">
            {isDepartment ? <CorporateFareRoundedIcon /> : <PeopleAltRoundedIcon />}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">
              {isDepartment ? 'Dashboard phòng ban' : 'Dashboard cá nhân'}
            </p>
            <p className="truncate text-base font-black text-slate-950" title={subjectLabel}>
              {subjectLabel}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-extrabold text-slate-700">
            {formatPeriodLabel(report.periodFrom, report.periodTo)}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Mốc KPI: {report.scope.targetLabel}
          </p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ScopedMetricCard
          label={isDepartment ? 'Lợi nhuận TEAM' : 'Lợi nhuận của tôi'}
          value={formatCompactMoney(report.summary.profitAmount)}
          helper="Lợi nhuận thực tế trước VAT"
          change={report.summary.profitChangeRate}
          icon={<TrendingUpRoundedIcon />}
          valueClassName={amountTone(report.summary.profitAmount)}
        />
        <ScopedMetricCard
          label={report.scope.targetLabel}
          value={formatCompactMoney(report.summary.targetAmount)}
          helper="Admin thiết lập theo từng tháng"
          icon={<InsightsRoundedIcon />}
          tone="brand"
          valueClassName="text-brand-blue"
        />
        <ScopedMetricCard
          label={isDepartment ? 'Hoàn thành KPI' : 'Đóng góp kế hoạch'}
          value={formatPercent(report.summary.completionRate)}
          helper={completionHelper}
          icon={<CheckCircleRoundedIcon />}
          valueClassName="text-primary"
        />
        <ScopedMetricCard
          label="Dự án đang quản lý"
          value={integerFormatter.format(report.operations.projects.totalCount)}
          helper={`${integerFormatter.format(report.operations.projects.newCount)} dự án mới trong kỳ`}
          change={report.operations.projects.managedChangeRate}
          icon={<CorporateFareRoundedIcon />}
          tone="brand"
        />
      </div>

      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-12">
        <div className="h-full xl:col-span-8">
          <ScopedProfitTrendChart report={report} />
        </div>
        <div className="h-full xl:col-span-4">
          <AttentionBoard report={report} />
        </div>
        <div className="h-full xl:col-span-5">
          <ProjectPortfolio
            report={report}
            subtitle={
              isDepartment
                ? 'Các dự án thuộc phạm vi phòng ban'
                : 'Các dự án bạn đang triển khai hoặc phụ trách'
            }
          />
        </div>
        <div className="h-full xl:col-span-7">
          {isDepartment ? (
            <EmployeePerformanceCard rows={report.employees} isFetching={isFetching} />
          ) : (
            <PersonalContributionCard row={employee} />
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisSection({ report, isFetching }: { report: DashboardReport; isFetching: boolean }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="h-full min-h-[500px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 pb-0 pt-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="pb-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
            Phân tích chuyên sâu
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Chi tiết KPI trong kỳ</h2>
        </div>
        <IconTabs
          value={activeTab}
          ariaLabel="Phạm vi phân tích Dashboard"
          onChange={setActiveTab}
          items={[
            { label: 'Theo dịch vụ', icon: <RoomServiceRoundedIcon fontSize="small" /> },
            { label: 'Theo phòng ban', icon: <CorporateFareRoundedIcon fontSize="small" /> },
          ]}
        />
      </div>

      <div className="max-h-[410px] overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
        {activeTab === 0 && <ServiceDashboard rows={report.services} isFetching={isFetching} />}
        {activeTab === 1 && (
          <DepartmentDashboard rows={report.departments} isFetching={isFetching} />
        )}
      </div>
    </section>
  );
}

export function DashboardOverview({
  report,
  filters,
  isFetching,
  onFiltersChange,
}: DashboardOverviewProps) {
  const comparisonLabel = formatPeriodLabel(
    report.comparison.periodFrom,
    report.comparison.periodTo,
  );
  const operationItems = useMemo(
    () => [
      {
        label: 'Lead mới',
        value: integerFormatter.format(report.operations.leads.newCount),
        helper: `${integerFormatter.format(report.operations.leads.openCount)} lead chưa chuyển khách`,
        change: report.operations.leads.newChangeRate,
        href: '/leads',
        icon: <GroupsRoundedIcon />,
        tone: 'primary' as const,
      },
      {
        label: 'Chuyển đổi lead',
        value:
          report.operations.leads.conversionRate === null
            ? '—'
            : `${compactNumber.format(report.operations.leads.conversionRate)}%`,
        helper: `${integerFormatter.format(report.operations.leads.convertedFromNewCount)} lead trong kỳ đã thành khách hàng`,
        href: '/leads',
        icon: <TrendingUpRoundedIcon />,
        tone: 'brand' as const,
      },
      {
        label: 'Khách hàng mới',
        value: integerFormatter.format(report.operations.customers.newCount),
        helper: `${integerFormatter.format(report.operations.customers.totalCount)} khách hàng đang quản lý`,
        change: report.operations.customers.newChangeRate,
        href: '/customers',
        icon: <PeopleAltRoundedIcon />,
        tone: 'primary' as const,
      },
      {
        label: 'Dự án mới',
        value: integerFormatter.format(report.operations.projects.newCount),
        helper: `${integerFormatter.format(report.operations.projects.totalCount)} dự án đang quản lý`,
        change: report.operations.projects.newChangeRate,
        href: '/projects',
        icon: <CorporateFareRoundedIcon />,
        tone: 'brand' as const,
      },
    ],
    [report.operations],
  );

  if (report.scope.level !== 'all') {
    return (
      <ScopedDashboardOverview
        report={report}
        filters={filters}
        isFetching={isFetching}
        onFiltersChange={onFiltersChange}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-[#f6f8fc] p-4 sm:p-6">
      <PageHeader
        title="Dashboard"
        actions={
          <DashboardPeriodFilterBar
            filters={filters}
            comparisonLabel={comparisonLabel}
            onChange={onFiltersChange}
          />
        }
      />

      <div className="-mt-3 mb-4 h-1 overflow-hidden rounded-full">
        {isFetching && <LinearProgress color="primary" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {operationItems.map((item) => (
          <OperationMetricCard key={item.label} {...item} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <CrmFlowCard report={report} />
        </div>
        <div className="xl:col-span-4">
          <AttentionBoard report={report} />
        </div>
      </div>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
            Tài chính & KPI
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Sức khỏe kinh doanh</h2>
        </div>
        <span className="hidden text-xs font-semibold text-slate-500 sm:block">
          So sánh với {comparisonLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric
          label="Đã thu"
          value={formatCompactMoney(report.summary.receivedAmount)}
          helper={`Có VAT và tiền cọc · ${changeText(report.summary.receivedChangeRate)}`}
          icon={<AccountBalanceWalletRoundedIcon />}
          valueClassName="text-primary"
        />
        <FinanceMetric
          label="Lợi nhuận"
          value={formatCompactMoney(report.summary.profitAmount)}
          helper={`Trước VAT · ${changeText(report.summary.profitChangeRate)}`}
          icon={<TrendingUpRoundedIcon />}
          valueClassName={amountTone(report.summary.profitAmount)}
        />
        <FinanceMetric
          label="Kế hoạch"
          value={formatCompactMoney(report.summary.targetAmount)}
          helper="Admin thiết lập cho kỳ đang xem"
          icon={<InsightsRoundedIcon />}
          valueClassName="text-brand-blue"
        />
        <FinanceMetric
          label="Hoàn thành"
          value={formatPercent(report.summary.completionRate)}
          helper="Lợi nhuận thực tế / kế hoạch"
          icon={<CheckCircleRoundedIcon />}
          valueClassName="text-primary"
        />
      </div>

      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-12">
        <div className="h-full xl:col-span-5">
          <ProjectPortfolio report={report} />
        </div>
        <div className="h-full xl:col-span-7">
          <CashTrendChart report={report} />
        </div>
        <div className="h-full xl:col-span-5">
          <ProfitTargetCard report={report} />
        </div>
        <div className="h-full xl:col-span-7">
          <AnalysisSection report={report} isFetching={isFetching} />
        </div>
      </div>
    </div>
  );
}
