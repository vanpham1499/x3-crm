'use client';

import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { BarChart } from '@mui/x-charts/BarChart';
import { ChartsContainer } from '@mui/x-charts/ChartsContainer';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { LinePlot, MarkPlot } from '@mui/x-charts/LineChart';
import { useXScale, useYScale } from '@mui/x-charts/hooks';
import { hasPermission } from '@/lib/ownership';
import { useAuthStore } from '@/stores/auth-store';
import type {
  DashboardLeadEmployee,
  DashboardLeadReport,
  DashboardLeadReportPeriod,
} from '@/types/dashboard';

const REQUIRED_LEAD_PERMISSIONS = [
  'lead.view',
  'lead.create',
  'lead.update',
  'lead.delete',
] as const;
const LEAD_TREND_COLOR = '#ff7a50';
const EMPLOYEE_COLORS = [
  '#ff7a50',
  '#b8d65f',
  '#49b59d',
  '#6f8fe8',
  '#f2bd4d',
  '#9b7ad8',
  '#59b9d2',
  '#ee8cb3',
  '#7bbf70',
  '#8b9bad',
];
const integerFormatter = new Intl.NumberFormat('vi-VN');

function EmptyLeadChart({ text }: { text: string }) {
  return (
    <div className="grid h-full min-h-64 place-items-center rounded-2xl bg-slate-50/80 px-6 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  );
}

function employeeLabel(employee: DashboardLeadEmployee) {
  return employee.code ? `${employee.code} - ${employee.name}` : employee.name;
}

function leadBarLabel(item: { value: number | null }) {
  return item.value && item.value > 0 ? integerFormatter.format(item.value) : null;
}

function LeadPointLabels({ periods }: { periods: DashboardLeadReportPeriod[] }) {
  const xScale = useXScale<'point'>('lead-period');
  const yScale = useYScale<'linear'>('lead-count');
  const labelStep = Math.max(1, Math.ceil(periods.length / 12));

  return (
    <g aria-hidden="true">
      {periods.map((period, index) => {
        if (index % labelStep !== 0 && index !== periods.length - 1) return null;

        const x = xScale(period.label);

        if (x === undefined) return null;

        return (
          <text
            key={period.period}
            x={x}
            y={yScale(period.total) - 12}
            fill={LEAD_TREND_COLOR}
            textAnchor="middle"
            className="text-[11px] font-black tabular-nums"
          >
            {integerFormatter.format(period.total)}
          </text>
        );
      })}
    </g>
  );
}

function MonthlyLeadChart({ periods }: { periods: DashboardLeadReportPeriod[] }) {
  const total = periods.reduce((sum, period) => sum + period.total, 0);
  const hasData = periods.some((period) => period.total > 0);
  const tickStep = Math.max(1, Math.ceil(periods.length / 12));

  return (
    <article className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-[22px] border border-white/90 bg-white p-5 shadow-[0_14px_34px_rgba(174,118,43,0.08)] xl:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[19px] font-bold tracking-[-0.02em] text-slate-800">
            Số lượng Lead theo tháng
          </h3>
          <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="size-2.5 rounded-full bg-[#ff7a50]" /> Lead phát sinh
          </span>
        </div>
        <div className="shrink-0 rounded-2xl bg-[#fff3ec] px-3.5 py-2.5 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#d85d37]">Tổng</p>
          <p className="mt-0.5 text-xl font-black tabular-nums text-[#d85d37]">
            {integerFormatter.format(total)}
          </p>
        </div>
      </div>

      <div
        className="mt-4 min-h-[290px] flex-1"
        role="img"
        aria-label={`Tổng ${total} Lead trong kỳ`}
      >
        {!hasData ? (
          <EmptyLeadChart text="Chưa có Lead phát sinh trong kỳ đã chọn" />
        ) : (
          <ChartsContainer
            height={305}
            margin={{ top: 18, right: 12, bottom: 4, left: 4 }}
            series={[
              {
                id: 'lead-total',
                type: 'line',
                label: 'Lead phát sinh',
                data: periods.map((period) => period.total),
                color: LEAD_TREND_COLOR,
                curve: 'linear',
                showMark: true,
                valueFormatter: (value) =>
                  value === null ? '' : `${integerFormatter.format(value)} Lead`,
              },
            ]}
            xAxis={[
              {
                id: 'lead-period',
                scaleType: 'point',
                data: periods.map((period) => period.label),
                height: 32,
                tickLabelInterval: (_value, index) =>
                  index % tickStep === 0 || index === periods.length - 1,
                tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
              },
            ]}
            yAxis={[
              {
                id: 'lead-count',
                min: 0,
                width: 42,
                valueFormatter: (value) => integerFormatter.format(Number(value)),
                tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
              },
            ]}
            sx={{
              '& .MuiChartsGrid-line': {
                stroke: '#e8eaed',
              },
              '& .MuiLineChart-line': {
                filter: 'drop-shadow(0 3px 4px rgb(255 122 80 / 0.18))',
                strokeWidth: 3,
              },
              '& .MuiMarkElement-root': {
                fill: '#fff',
                stroke: LEAD_TREND_COLOR,
                strokeWidth: 3,
              },
            }}
          >
            <ChartsGrid horizontal />
            <LinePlot />
            <MarkPlot />
            <LeadPointLabels periods={periods} />
            <ChartsXAxis axisId="lead-period" disableLine disableTicks />
            <ChartsYAxis axisId="lead-count" disableLine disableTicks />
            <ChartsTooltip trigger="axis" />
          </ChartsContainer>
        )}
      </div>
    </article>
  );
}

function EmployeeLeadChart({
  periods,
  employees,
}: {
  periods: DashboardLeadReportPeriod[];
  employees: DashboardLeadEmployee[];
}) {
  const hasData = employees.some((employee) => employee.total > 0);
  const tickStep = Math.max(1, Math.ceil(periods.length / 12));

  return (
    <article className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-[22px] border border-white/90 bg-white p-5 shadow-[0_14px_34px_rgba(174,118,43,0.08)] xl:p-6">
      <div>
        <h3 className="text-[19px] font-bold tracking-[-0.02em] text-slate-800">
          Số lượng Lead theo nhân sự
        </h3>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {employees.map((employee, index) => (
            <span
              key={employee.id}
              className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-600"
              title={employeeLabel(employee)}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length] }}
              />
              <span className="max-w-36 truncate">{employee.name}</span>
              <span className="font-black tabular-nums text-slate-900">
                {integerFormatter.format(employee.total)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div
        className="mt-3 min-h-[270px] flex-1"
        role="img"
        aria-label={`So sánh số Lead của ${employees.length} nhân sự`}
      >
        {!hasData ? (
          <EmptyLeadChart text="Chưa có Lead được phân công trong kỳ đã chọn" />
        ) : (
          <BarChart
            height={290}
            hideLegend
            borderRadius={5}
            grid={{ horizontal: true }}
            margin={{ top: 12, right: 8, bottom: 4, left: 4 }}
            xAxis={[
              {
                id: 'employee-lead-period',
                scaleType: 'band',
                data: periods.map((period) => period.label),
                height: 32,
                tickLabelInterval: (_value, index) =>
                  index % tickStep === 0 || index === periods.length - 1,
                tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
              },
            ]}
            yAxis={[
              {
                id: 'employee-lead-count',
                min: 0,
                width: 42,
                valueFormatter: (value) => integerFormatter.format(Number(value)),
                tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
              },
            ]}
            series={employees.map((employee, index) => ({
              id: `employee-${employee.id}`,
              label: employeeLabel(employee),
              data: employee.values,
              color: EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length],
              barLabel: leadBarLabel,
              valueFormatter: (value: number | null) =>
                value === null ? '' : `${integerFormatter.format(value)} Lead`,
            }))}
            sx={{
              '& .MuiChartsGrid-line': { stroke: '#e8edf3', strokeDasharray: '3 5' },
              '& .MuiBarElement-root': {
                transition: 'opacity 180ms ease, filter 180ms ease',
              },
              '& .MuiBarElement-root:hover': {
                filter: 'brightness(0.96)',
              },
              '& .MuiBarLabel-root': {
                fill: '#334155',
                fontSize: 10,
                fontWeight: 900,
              },
            }}
          />
        )}
      </div>
    </article>
  );
}

function LeadStatusCard({
  periods,
  employee,
}: {
  periods: DashboardLeadReportPeriod[];
  employee: DashboardLeadEmployee;
}) {
  const chartHeight = Math.min(560, Math.max(280, periods.length * 34 + 78));

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[22px] border border-white/90 bg-white p-5 shadow-[0_14px_34px_rgba(174,118,43,0.08)] xl:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[19px] font-bold tracking-[-0.02em] text-slate-800">
            Tình trạng khách {employee.name}
          </h3>
          {employee.code && (
            <p className="mt-1 text-xs font-semibold text-slate-500">{employee.code}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black tabular-nums text-primary">
          {integerFormatter.format(employee.total)} Lead
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {employee.statusSeries.map((series) => (
          <span
            key={series.statusId}
            className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-600"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            <span className="max-w-40 truncate" title={series.label}>
              {series.label}
            </span>
            <span className="font-black tabular-nums text-slate-900">
              {integerFormatter.format(series.total)}
            </span>
          </span>
        ))}
      </div>

      <div
        className="mt-3 min-h-[260px] flex-1"
        role="img"
        aria-label={`Cơ cấu trạng thái ${employee.total} Lead của ${employee.name}`}
      >
        <BarChart
          layout="horizontal"
          height={chartHeight}
          hideLegend
          borderRadius={4}
          grid={{ vertical: true }}
          margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
          yAxis={[
            {
              id: `status-period-${employee.id}`,
              scaleType: 'band',
              data: periods.map((period) => period.label),
              width: 70,
              tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
            },
          ]}
          xAxis={[
            {
              id: `status-count-${employee.id}`,
              min: 0,
              height: 26,
              valueFormatter: (value) => integerFormatter.format(Number(value)),
              tickLabelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
            },
          ]}
          series={employee.statusSeries.map((series) => ({
            id: `employee-${employee.id}-status-${series.statusId}`,
            label: series.label,
            data: series.values,
            stack: `employee-${employee.id}-statuses`,
            color: series.color,
            barLabel: leadBarLabel,
            valueFormatter: (value: number | null) =>
              value === null ? '' : `${integerFormatter.format(value)} Lead`,
          }))}
          sx={{
            '& .MuiChartsGrid-line': { stroke: '#e8edf3', strokeDasharray: '3 5' },
            '& .MuiBarElement-root': {
              transition: 'opacity 180ms ease, filter 180ms ease',
            },
            '& .MuiBarElement-root:hover': {
              filter: 'brightness(0.96)',
            },
            '& .MuiBarLabel-root': {
              fill: '#fff',
              stroke: 'rgb(15 23 42 / 0.5)',
              strokeWidth: 2.2,
              paintOrder: 'stroke',
              fontSize: 10,
              fontWeight: 900,
            },
          }}
        />
      </div>
    </article>
  );
}

export function LeadReportSection({ report }: { report: DashboardLeadReport | null }) {
  const user = useAuthStore((state) => state.user);
  const canViewLeadReport = REQUIRED_LEAD_PERMISSIONS.every((permission) =>
    hasPermission(user, permission),
  );

  if (!canViewLeadReport || !report) {
    return null;
  }

  const total = report.periods.reduce((sum, period) => sum + period.total, 0);

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] border border-[#f3dfbd] bg-[#fff3dd] p-3 shadow-[0_18px_45px_rgba(180,122,45,0.07)] sm:p-4">
      <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[#d85d37] shadow-sm [&>svg]:!text-[22px]">
            <GroupsRoundedIcon />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d85d37]">
              Lead analytics
            </p>
            <h2 className="mt-0.5 text-xl font-black tracking-[-0.02em] text-slate-900">
              Báo cáo Lead
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-full bg-white px-3 py-2 shadow-sm">
            {integerFormatter.format(total)} Lead
          </span>
          <span className="rounded-full bg-white px-3 py-2 shadow-sm">
            {report.employees.length} nhân sự
          </span>
        </div>
      </div>

      <div className="grid items-stretch gap-5 xl:grid-cols-2">
        <MonthlyLeadChart periods={report.periods} />
        <EmployeeLeadChart periods={report.periods} employees={report.employees} />
      </div>

      {report.employees.length > 0 && (
        <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-2">
          {report.employees.map((employee) => (
            <LeadStatusCard key={employee.id} periods={report.periods} employee={employee} />
          ))}
        </div>
      )}
    </section>
  );
}
