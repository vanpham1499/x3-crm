'use client';

import { useMemo, useState, type ReactNode } from 'react';
import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded';
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { MenuItem, Select } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { hasPermission } from '@/lib/ownership';
import { formatUserLabel } from '@/lib/user-utils';
import { useAuthStore } from '@/stores/auth-store';
import { siteConfig } from '@/config/site';
import type {
  DashboardLeadEmployee,
  DashboardLeadReport,
  DashboardLeadReportPeriod,
  DashboardLeadStatusSeries,
  DashboardProjectEmployee,
  DashboardProjectReport,
} from '@/types/dashboard';

const REQUIRED_LEAD_PERMISSIONS = [
  'lead.view',
  'lead.create',
  'lead.update',
  'lead.delete',
] as const;
const REQUIRED_PROJECT_PERMISSIONS = [
  'project.view',
  'project.create',
  'project.update',
  'project.delete',
] as const;
const SERIES_COLORS = [
  '#00a878',
  '#0b7db3',
  '#7c3aed',
  '#f59e0b',
  '#ef476f',
  '#14b8a6',
  '#6366f1',
  '#f97316',
  '#84a640',
  '#8b5cf6',
];
const LEAD_COLOR = '#f97356';
const integerFormatter = new Intl.NumberFormat('vi-VN');
const compactFormatter = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

type ReportModule = 'lead' | 'project';
type LeadView = 'trend' | 'employee' | 'status';
type ProjectView = 'count' | 'profit' | 'status';
type StatusEmployee = {
  code?: string | null;
  name: string;
  statusSeries: DashboardLeadStatusSeries[];
};

function formatMoney(value: number) {
  return `${compactFormatter.format(value)} đ`;
}

function countBarLabel(item: { value: number | null }) {
  return item.value && item.value > 0 ? integerFormatter.format(item.value) : null;
}

function moneyBarLabel(item: { value: number | null }) {
  return item.value && Math.abs(item.value) > 0 ? compactFormatter.format(item.value) : null;
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="grid h-[300px] place-items-center rounded-2xl bg-slate-50 px-6 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}

function ModuleButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        active
          ? 'bg-slate-950 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
      }`}
    >
      <span className="[&>svg]:!text-[19px]">{icon}</span>
      {label}
    </button>
  );
}

function ViewTabs<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={`min-h-10 shrink-0 rounded-lg px-3.5 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            value === item.value
              ? 'bg-white text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500">
      {label}
      <strong className="font-black tabular-nums text-slate-950">{value}</strong>
    </span>
  );
}

function PeriodLegend({ periods }: { periods: Array<{ label: string }> }) {
  if (periods.length === 1) {
    return (
      <span className="inline-flex min-h-7 items-center rounded-lg bg-slate-100 px-2.5 text-[11px] font-extrabold text-slate-600">
        {periods[0].label}
      </span>
    );
  }

  return (
    <div className="flex max-h-14 flex-wrap gap-x-3 gap-y-1.5 overflow-y-auto pr-1">
      {periods.map((period, index) => (
        <span
          key={`${period.label}-${index}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500"
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }}
          />
          {period.label}
        </span>
      ))}
    </div>
  );
}

function thinBarCategoryGap(employeeCount: number, periodCount: number) {
  if (periodCount >= 5) return 0.22;
  if (periodCount >= 2) return 0.48;
  if (employeeCount <= 2) return 0.9;
  if (employeeCount <= 5) return 0.74;
  if (employeeCount <= 8) return 0.62;

  return 0.48;
}

function LeadTrendChart({ periods }: { periods: DashboardLeadReportPeriod[] }) {
  const hasData = periods.some((period) => period.total > 0);

  if (!hasData) {
    return <EmptyChart text="Chưa có Lead phát sinh trong kỳ đã chọn" />;
  }

  return (
    <LineChart
      height={310}
      hideLegend
      grid={{ horizontal: true }}
      margin={{ top: 18, right: 16, bottom: 6, left: 4 }}
      xAxis={[
        {
          scaleType: 'point',
          data: periods.map((period) => period.label),
          height: 32,
          tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
        },
      ]}
      yAxis={[
        {
          min: 0,
          width: 42,
          valueFormatter: (value) => integerFormatter.format(Number(value)),
          tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
        },
      ]}
      series={[
        {
          id: 'lead-total',
          label: 'Lead phát sinh',
          data: periods.map((period) => period.total),
          color: LEAD_COLOR,
          curve: 'monotoneX',
          area: true,
          showMark: true,
          valueFormatter: (value) =>
            value === null ? '' : `${integerFormatter.format(value)} Lead`,
        },
      ]}
      sx={{
        '& .MuiChartsGrid-line': { stroke: '#e8edf3', strokeDasharray: '3 5' },
        '& .MuiLineElement-root': { strokeWidth: 3 },
        '& .MuiAreaElement-root': { fillOpacity: 0.09 },
        '& .MuiMarkElement-root': {
          fill: '#fff',
          stroke: LEAD_COLOR,
          strokeWidth: 3,
        },
      }}
    />
  );
}

function EmployeeCountChart({
  periods,
  employees,
  kind,
}: {
  periods: Array<{ label: string }>;
  employees: Array<DashboardLeadEmployee | DashboardProjectEmployee>;
  kind: 'lead' | 'project';
}) {
  const getValues = (employee: DashboardLeadEmployee | DashboardProjectEmployee) =>
    kind === 'lead'
      ? (employee as DashboardLeadEmployee).values
      : (employee as DashboardProjectEmployee).projectValues;
  const hasData = employees.some((employee) => getValues(employee).some((value) => value > 0));

  if (!hasData) {
    return (
      <EmptyChart
        text={kind === 'lead' ? 'Chưa có Lead theo nhân sự' : 'Chưa có dự án mới trong kỳ đã chọn'}
      />
    );
  }

  return (
    <BarChart
      height={310}
      hideLegend
      borderRadius={5}
      grid={{ horizontal: true }}
      margin={{ top: 16, right: 12, bottom: 6, left: 4 }}
      xAxis={[
        {
          scaleType: 'band',
          data: employees.map((employee) => formatUserLabel(employee)),
          categoryGapRatio: thinBarCategoryGap(employees.length, periods.length),
          barGapRatio: periods.length > 1 ? 0.28 : 0.08,
          height: 48,
          tickLabelStyle: { fill: '#475569', fontSize: 10, fontWeight: 800 },
        },
      ]}
      yAxis={[
        {
          min: 0,
          tickMinStep: 1,
          width: 42,
          valueFormatter: (value) => integerFormatter.format(Number(value)),
          tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
        },
      ]}
      series={periods.map((period, periodIndex) => ({
        id: `${kind}-period-${periodIndex}`,
        label: period.label,
        data: employees.map((employee) => getValues(employee)[periodIndex] ?? 0),
        color: SERIES_COLORS[periodIndex % SERIES_COLORS.length],
        colorGetter:
          periods.length === 1
            ? ({ dataIndex }: { dataIndex: number }) =>
                SERIES_COLORS[dataIndex % SERIES_COLORS.length]
            : undefined,
        barLabel: periods.length <= 3 && employees.length <= 8 ? countBarLabel : undefined,
        valueFormatter: (value: number | null) =>
          value === null
            ? ''
            : `${integerFormatter.format(value)} ${kind === 'lead' ? 'Lead' : 'dự án mới'}`,
      }))}
      sx={{
        '& .MuiChartsGrid-line': { stroke: '#e8edf3', strokeDasharray: '3 5' },
        '& .MuiBarElement-root': { transition: 'filter 180ms ease, opacity 180ms ease' },
        '& .MuiBarElement-root:hover': { filter: 'brightness(0.96)' },
        '& .MuiBarLabel-root': { fill: '#334155', fontSize: 10, fontWeight: 900 },
      }}
    />
  );
}

function ProjectMonthlyChart({ periods }: { periods: DashboardProjectReport['periods'] }) {
  if (!periods.some(period => period.total > 0)) {
    return <EmptyChart text="Chưa có dự án mới trong kỳ đã chọn" />;
  }

  return <>
    <BarChart
      height={260}
      hideLegend
      borderRadius={5}
      grid={{ horizontal: true }}
      margin={{ top: 16, right: 12, bottom: 6, left: 4 }}
      xAxis={[{
        scaleType: 'band',
        data: periods.map(period => period.label),
        categoryGapRatio: periods.length <= 2 ? 0.88 : 0.55,
        height: 40,
        tickLabelStyle: { fill: '#64748b', fontSize: 11 },
      }]}
      yAxis={[{ min: 0, tickMinStep: 1, width: 42, valueFormatter: value => integerFormatter.format(Number(value)) }]}
      series={[{
        id: 'new-projects-monthly',
        label: 'Dự án mới',
        data: periods.map(period => period.total),
        color: siteConfig.brand.primary,
        barLabel: countBarLabel,
        valueFormatter: value => value === null ? '' : `${integerFormatter.format(value)} dự án mới`,
      }]}
      sx={{
        '& .MuiChartsGrid-line': { stroke: '#e8edf3', strokeDasharray: '3 5' },
        '& .MuiBarLabel-root': { fill: '#334155', fontSize: 12, fontWeight: 700 },
      }}
    />
    <table className="sr-only">
      <caption>Dự án mới theo tháng</caption>
      <thead><tr><th scope="col">Tháng</th><th scope="col">Dự án mới</th></tr></thead>
      <tbody>{periods.map(period => <tr key={period.period}><th scope="row">{period.label}</th><td>{period.total}</td></tr>)}</tbody>
    </table>
  </>;
}

function EmployeeProfitChart({
  periods,
  employees,
}: {
  periods: Array<{ label: string }>;
  employees: DashboardProjectEmployee[];
}) {
  const hasData = employees.some((employee) =>
    employee.profitValues.some((value) => Math.abs(value) > 0),
  );

  if (!hasData) {
    return <EmptyChart text="Chưa có KPI triển khai theo nhân sự trong kỳ" />;
  }

  return (
    <BarChart
      height={310}
      hideLegend
      borderRadius={5}
      grid={{ horizontal: true }}
      margin={{ top: 16, right: 12, bottom: 6, left: 4 }}
      xAxis={[
        {
          scaleType: 'band',
          data: employees.map((employee) => formatUserLabel(employee)),
          categoryGapRatio: thinBarCategoryGap(employees.length, periods.length),
          barGapRatio: periods.length > 1 ? 0.28 : 0.08,
          height: 48,
          tickLabelStyle: { fill: '#475569', fontSize: 10, fontWeight: 800 },
        },
      ]}
      yAxis={[
        {
          width: 64,
          valueFormatter: (value) => compactFormatter.format(Number(value)),
          tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
        },
      ]}
      series={periods.map((period, periodIndex) => ({
        id: `project-profit-period-${periodIndex}`,
        label: period.label,
        data: employees.map((employee) => employee.profitValues[periodIndex] ?? 0),
        color: SERIES_COLORS[periodIndex % SERIES_COLORS.length],
        colorGetter:
          periods.length === 1
            ? ({ dataIndex }: { dataIndex: number }) =>
                SERIES_COLORS[dataIndex % SERIES_COLORS.length]
            : undefined,
        barLabel: periods.length <= 2 && employees.length <= 6 ? moneyBarLabel : undefined,
        valueFormatter: (value: number | null) => (value === null ? '' : formatMoney(value)),
      }))}
      sx={{
        '& .MuiChartsGrid-line': { stroke: '#e8edf3', strokeDasharray: '3 5' },
        '& .MuiBarElement-root': { transition: 'filter 180ms ease, opacity 180ms ease' },
        '& .MuiBarElement-root:hover': { filter: 'brightness(0.96)' },
        '& .MuiBarLabel-root': { fill: '#334155', fontSize: 9, fontWeight: 900 },
      }}
    />
  );
}

function StatusChart({
  periods,
  employees,
  periodIndex,
  unit,
}: {
  periods: Array<{ label: string }>;
  employees: StatusEmployee[];
  periodIndex: number;
  unit: 'Lead' | 'Dự án mới';
}) {
  const safePeriodIndex = Math.min(Math.max(periodIndex, 0), Math.max(periods.length - 1, 0));
  const statusSeries = useMemo(() => {
    const definitions = new Map<
      number,
      Pick<DashboardLeadStatusSeries, 'statusId' | 'key' | 'label' | 'color'>
    >();

    employees.forEach((employee) => {
      employee.statusSeries.forEach((series) => {
        if (!definitions.has(series.statusId)) {
          definitions.set(series.statusId, {
            statusId: series.statusId,
            key: series.key,
            label: series.label,
            color: series.color,
          });
        }
      });
    });

    return Array.from(definitions.values())
      .map((definition) => {
        const data = employees.map(
          (employee) =>
            employee.statusSeries.find((series) => series.statusId === definition.statusId)?.values[
              safePeriodIndex
            ] ?? 0,
        );

        return {
          ...definition,
          data,
          total: data.reduce((sum, value) => sum + value, 0),
        };
      })
      .filter((series) => series.total > 0);
  }, [employees, safePeriodIndex]);

  if (employees.length === 0 || statusSeries.length === 0) {
    return <EmptyChart text={`Chưa có trạng thái ${unit} để tổng hợp`} />;
  }

  const showBarLabels = employees.length <= 8 && statusSeries.length <= 5;

  return (
    <>
      <div className="mb-1.5 flex max-h-12 flex-wrap gap-x-4 gap-y-1.5 overflow-y-auto">
        {statusSeries.map((series) => (
          <span
            key={series.statusId}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600"
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: series.color }} />
            {series.label}
            <strong className="font-black tabular-nums text-slate-900">
              {integerFormatter.format(series.total)}
            </strong>
          </span>
        ))}
      </div>
      <BarChart
        height={260}
        hideLegend
        borderRadius={5}
        grid={{ horizontal: true }}
        margin={{ top: 8, right: 12, bottom: 2, left: 4 }}
        xAxis={[
          {
            scaleType: 'band',
            data: employees.map((employee) => formatUserLabel(employee)),
            categoryGapRatio: Math.min(0.88, thinBarCategoryGap(employees.length, 1) + 0.1),
            barGapRatio: 0.08,
            height: 48,
            tickLabelStyle: { fill: '#475569', fontSize: 10, fontWeight: 800 },
          },
        ]}
        yAxis={[
          {
            min: 0,
            width: 48,
            valueFormatter: (value) => integerFormatter.format(Number(value)),
            tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
          },
        ]}
        series={statusSeries.map((series) => ({
          id: `${unit}-period-${safePeriodIndex}-status-${series.statusId}`,
          label: series.label,
          data: series.data,
          stack: `${unit}-period-${safePeriodIndex}-statuses`,
          color: series.color,
          barLabel: showBarLabels ? countBarLabel : undefined,
          valueFormatter: (value: number | null) =>
            value === null ? '' : `${integerFormatter.format(value)} ${unit}`,
        }))}
        sx={{
          '& .MuiChartsGrid-line': { stroke: '#e8edf3', strokeDasharray: '3 5' },
          '& .MuiBarElement-root': { transition: 'filter 180ms ease, opacity 180ms ease' },
          '& .MuiBarElement-root:hover': { filter: 'brightness(0.96)' },
          '& .MuiBarLabel-root': {
            fill: '#fff',
            stroke: 'rgb(15 23 42 / 0.48)',
            strokeWidth: 2,
            paintOrder: 'stroke',
            fontSize: 10,
            fontWeight: 900,
          },
        }}
      />
    </>
  );
}

function PeriodSelect({
  periods,
  value,
  onChange,
}: {
  periods: Array<{ label: string }>;
  value: number;
  onChange: (value: number) => void;
}) {
  if (periods.length === 0) return null;
  if (periods.length === 1) {
    return (
      <span className="inline-flex min-h-9 items-center rounded-lg bg-slate-100 px-3 text-[11px] font-extrabold text-slate-600">
        {periods[0].label}
      </span>
    );
  }

  return (
    <Select
      size="small"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      inputProps={{ 'aria-label': 'Chọn tháng để xem trạng thái nhân sự' }}
      sx={{
        width: 220,
        maxWidth: '100%',
        minHeight: 36,
        borderRadius: '10px',
        backgroundColor: '#fff',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {periods.map((period, index) => (
        <MenuItem key={`${period.label}-${index}`} value={index}>
          {period.label}
        </MenuItem>
      ))}
    </Select>
  );
}

export function TeamReportSection({
  leadReport,
  projectReport,
}: {
  leadReport: DashboardLeadReport | null;
  projectReport: DashboardProjectReport | null;
}) {
  const user = useAuthStore((state) => state.user);
  const canViewLeadReport = REQUIRED_LEAD_PERMISSIONS.every((permission) =>
    hasPermission(user, permission),
  );
  const canViewProjectReport = REQUIRED_PROJECT_PERMISSIONS.every((permission) =>
    hasPermission(user, permission),
  );
  const hasLeadReport = canViewLeadReport && Boolean(leadReport);
  const hasProjectReport = canViewProjectReport && Boolean(projectReport);
  const [module, setModule] = useState<ReportModule>(hasLeadReport ? 'lead' : 'project');
  const [leadView, setLeadView] = useState<LeadView>('trend');
  const [projectView, setProjectView] = useState<ProjectView>('count');
  const [leadStatusPeriodIndex, setLeadStatusPeriodIndex] = useState<number | null>(null);
  const [projectStatusPeriodIndex, setProjectStatusPeriodIndex] = useState<number | null>(null);
  const activeModule: ReportModule =
    module === 'lead' && hasLeadReport
      ? 'lead'
      : module === 'project' && hasProjectReport
        ? 'project'
        : hasLeadReport
          ? 'lead'
          : 'project';
  const activeLeadStatusPeriodIndex = Math.min(
    leadStatusPeriodIndex ?? Math.max((leadReport?.periods.length ?? 1) - 1, 0),
    Math.max((leadReport?.periods.length ?? 1) - 1, 0),
  );
  const activeProjectStatusPeriodIndex = Math.min(
    projectStatusPeriodIndex ?? Math.max((projectReport?.periods.length ?? 1) - 1, 0),
    Math.max((projectReport?.periods.length ?? 1) - 1, 0),
  );

  if (!hasLeadReport && !hasProjectReport) {
    return null;
  }

  const leadTotal = leadReport?.periods.reduce((sum, period) => sum + period.total, 0) ?? 0;
  const projectTotal = projectReport?.periods.reduce((sum, period) => sum + period.total, 0) ?? 0;
  const projectCountEmployees = projectReport?.employees.filter(employee => employee.total > 0) ?? [];
  const projectPeople = projectView === 'profit' ? projectReport?.employees ?? [] : projectCountEmployees;
  const projectProfit =
    projectReport?.periods.reduce((sum, period) => sum + period.profitAmount, 0) ?? 0;
  const isLead = activeModule === 'lead';

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:!text-[21px]">
            <AnalyticsRoundedIcon />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-[-0.02em] text-slate-950">
              Báo cáo theo team
            </h2>
            <p className="truncate text-xs font-semibold text-slate-500">
              Theo dõi dữ liệu nhân sự trên cùng một kỳ báo cáo
            </p>
          </div>
        </div>

        <div className="flex w-fit max-w-full gap-1 rounded-2xl bg-slate-100 p-1">
          {hasLeadReport && (
            <ModuleButton
              active={activeModule === 'lead'}
              label="Lead"
              icon={<GroupsRoundedIcon />}
              onClick={() => setModule('lead')}
            />
          )}
          {hasProjectReport && (
            <ModuleButton
              active={activeModule === 'project'}
              label="Dự án"
              icon={<CorporateFareRoundedIcon />}
              onClick={() => setModule('project')}
            />
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {isLead ? (
            <ViewTabs<LeadView>
              value={leadView}
              onChange={setLeadView}
              items={[
                { value: 'trend', label: 'Xu hướng Lead' },
                { value: 'employee', label: 'Theo nhân sự' },
                { value: 'status', label: 'Theo trạng thái' },
              ]}
            />
          ) : (
            <ViewTabs<ProjectView>
              value={projectView}
              onChange={setProjectView}
              items={[
                { value: 'count', label: 'Dự án mới' },
                { value: 'profit', label: 'KPI' },
                { value: 'status', label: 'Theo trạng thái' },
              ]}
            />
          )}

          <div className="flex flex-wrap gap-2">
            {isLead ? (
              <>
                <StatPill label="Tổng" value={`${integerFormatter.format(leadTotal)} Lead`} />
                <StatPill
                  label="Nhân sự"
                  value={integerFormatter.format(leadReport?.employees.length ?? 0)}
                />
              </>
            ) : (
              <>
                <StatPill label="Dự án mới" value={integerFormatter.format(projectTotal)} />
                <StatPill label="KPI" value={formatMoney(projectProfit)} />
                <StatPill
                  label="Nhân sự"
                  value={integerFormatter.format(projectPeople.filter(employee => employee.id > 0).length)}
                />
              </>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="mb-3 flex min-h-10 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {isLead && leadView === 'trend' && (
                <p className="text-sm font-black text-slate-900">Số lượng Lead theo tháng</p>
              )}
              {isLead && leadView === 'employee' && leadReport && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="text-sm font-black text-slate-900">Lead theo nhân sự</p>
                  <PeriodLegend periods={leadReport.periods} />
                </div>
              )}
              {!isLead && projectView === 'count' && projectReport && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <h3 className="text-sm font-bold text-slate-900">Dự án mới theo nhân sự</h3>
                  <PeriodLegend periods={projectReport.periods} />
                </div>
              )}
              {!isLead && projectView === 'profit' && projectReport && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="text-sm font-black text-slate-900">KPI theo nhân sự</p>
                  <PeriodLegend periods={projectReport.periods} />
                </div>
              )}
              {((isLead && leadView === 'status') || (!isLead && projectView === 'status')) && (
                <p className="text-sm font-black text-slate-900">{isLead ? 'Trạng thái theo từng nhân sự' : 'Trạng thái dự án mới theo nhân sự'}</p>
              )}
            </div>

            {isLead && leadView === 'status' && leadReport && (
              <PeriodSelect
                periods={leadReport.periods}
                value={activeLeadStatusPeriodIndex}
                onChange={setLeadStatusPeriodIndex}
              />
            )}
            {!isLead && projectView === 'status' && projectReport && (
              <PeriodSelect
                periods={projectReport.periods}
                value={activeProjectStatusPeriodIndex}
                onChange={setProjectStatusPeriodIndex}
              />
            )}
          </div>

          <div
            role="img"
            aria-label={isLead ? 'Báo cáo Lead theo team' : projectView === 'count' ? `Dự án mới theo nhân sự: ${projectTotal} dự án trong kỳ` : 'Báo cáo Dự án theo team'}
          >
            {isLead && leadView === 'trend' && leadReport && (
              <LeadTrendChart periods={leadReport.periods} />
            )}
            {isLead && leadView === 'employee' && leadReport && (
              <EmployeeCountChart
                kind="lead"
                periods={leadReport.periods}
                employees={leadReport.employees}
              />
            )}
            {isLead && leadView === 'status' && leadReport && (
              <StatusChart
                unit="Lead"
                periods={leadReport.periods}
                employees={leadReport.employees}
                periodIndex={activeLeadStatusPeriodIndex}
              />
            )}
            {!isLead && projectView === 'count' && projectReport && (
              <EmployeeCountChart
                kind="project"
                periods={projectReport.periods}
                employees={projectCountEmployees}
              />
            )}
            {!isLead && projectView === 'profit' && projectReport && (
              <EmployeeProfitChart
                periods={projectReport.periods}
                employees={projectReport.employees}
              />
            )}
            {!isLead && projectView === 'status' && projectReport && (
              <StatusChart
                unit="Dự án mới"
                periods={projectReport.periods}
                employees={projectCountEmployees}
                periodIndex={activeProjectStatusPeriodIndex}
              />
            )}
          </div>
        </div>
        {!isLead && projectView === 'count' && projectReport && (
          <section className="mt-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" aria-labelledby="new-projects-monthly-title">
            <div className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-2">
              <h3 id="new-projects-monthly-title" className="text-sm font-bold text-slate-900">Dự án mới theo tháng</h3>
              <span className="text-xs text-slate-500">Tổng <strong className="font-semibold tabular-nums text-slate-900">{integerFormatter.format(projectTotal)}</strong> dự án mới</span>
            </div>
            <ProjectMonthlyChart periods={projectReport.periods} />
          </section>
        )}
      </div>
    </section>
  );
}
