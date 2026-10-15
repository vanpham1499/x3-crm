'use client';

import { ChartsContainer } from '@mui/x-charts/ChartsContainer';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { LinePlot } from '@mui/x-charts/LineChart';
import { siteConfig } from '@/config/site';
import { formatCurrency } from '@/lib/utils';
import type { DashboardReport } from '@/types/dashboard';

const compactMoney = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const shortDate = (date: string | null) => (date ? date.split('-').reverse().join('/') : '—');

export function ScopedKpiTrendChart({ report }: { report: DashboardReport }) {
  const trend = report.profitTrend;
  if (!trend) return null;
  const data = trend.points;
  const visible = data.filter((point) => point.to !== null);
  const difference = trend.difference;
  const differenceLabel =
    difference === null
      ? 'Chênh lệch cùng kỳ'
      : difference < 0
        ? 'Còn thiếu so với cùng kỳ'
        : difference > 0
          ? 'Vượt cùng kỳ'
          : 'Bằng cùng kỳ';
  const tickStep = Math.max(1, Math.ceil(data.length / 7));
  const mismatch = trend.comparisonReason === 'different_basis';

  return (
    <section className="flex h-full min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] xl:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">KPI lũy kế</h2>
          <p className="mt-1 text-xs text-slate-500">
            {shortDate(trend.from)} – {shortDate(trend.to)} · Giờ Việt Nam
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-primary" />
            Kỳ đang xem
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-brand-blue" />
            Kỳ trước
          </span>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-4 border-y border-slate-100 py-4 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">
            {trend.partial ? 'Lũy kế đến hôm nay' : 'Lũy kế trong kỳ'}
          </dt>
          <dd className="mt-1 text-lg font-extrabold tabular-nums text-primary">
            {trend.future ? '—' : formatCurrency(trend.currentAmount)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">
            {mismatch ? 'Kỳ trước · khác công thức' : 'Cùng kỳ trước'}
          </dt>
          <dd className="mt-1 text-lg font-extrabold tabular-nums text-brand-blue">
            {trend.future ? '—' : formatCurrency(trend.previousAmount)}
          </dd>
          <dd className="mt-1 text-xs text-slate-500">
            {shortDate(trend.previousFrom)} – {shortDate(trend.previousTo)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">{differenceLabel}</dt>
          <dd
            className={`mt-1 text-lg font-extrabold tabular-nums ${difference !== null && difference < 0 ? 'text-rose-700' : 'text-slate-950'}`}
          >
            {difference === null ? '—' : formatCurrency(Math.abs(difference))}
          </dd>
          {trend.changeRate !== null && (
            <dd className="mt-1 text-xs text-slate-500">
              {trend.changeRate > 0 ? '+' : ''}
              {trend.changeRate.toLocaleString('vi-VN')}% so với cùng kỳ
            </dd>
          )}
        </div>
      </dl>
      {mismatch && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Khác công thức KPI · Không so sánh chênh lệch giữa hai kỳ.
        </p>
      )}

      {trend.future ? (
        <div className="grid min-h-[280px] place-items-center text-sm text-slate-500">
          Kỳ này chưa bắt đầu
        </div>
      ) : (
        <div
          className="mt-4 min-w-0"
          role="img"
          aria-label={`KPI lũy kế ${formatCurrency(trend.currentAmount)}. ${mismatch ? 'Hai kỳ khác công thức.' : `${differenceLabel}: ${formatCurrency(Math.abs(difference ?? 0))}.`} Bảng số liệu ở bên dưới.`}
        >
          <ChartsContainer
            height={300}
            skipAnimation
            margin={{ top: 12, right: 28, bottom: 8, left: 0 }}
            series={[
              {
                id: 'current-kpi',
                type: 'line',
                label: 'Kỳ đang xem',
                data: data.map((point) => point.cumulativeProfitAmount),
                color: siteConfig.brand.primary,
                curve: 'linear',
                showMark: visible.length === 1,
                connectNulls: false,
                valueFormatter: (value, context) => {
                  if (value === null) return '—';
                  const gap = data[context.dataIndex]?.difference;
                  return `${formatCurrency(value)}${gap == null ? '' : ` (${gap >= 0 ? '+' : '−'}${formatCurrency(Math.abs(gap))})`}`;
                },
              },
              {
                id: 'previous-kpi',
                type: 'line',
                label: mismatch ? 'Kỳ trước · khác công thức' : 'Kỳ trước',
                data: data.map((point) => point.previousCumulativeProfitAmount),
                color: siteConfig.brand.blue,
                curve: 'linear',
                showMark: visible.length === 1,
                connectNulls: false,
                valueFormatter: (value) => (value === null ? '—' : formatCurrency(value)),
              },
            ]}
            xAxis={[
              {
                id: 'period',
                scaleType: 'point',
                data: data.map((_, index) => index),
                valueFormatter: (index, context) =>
                  context.location === 'tooltip'
                    ? `Đến ${shortDate(data[index]?.to)} / kỳ trước ${shortDate(data[index]?.previousTo)}`
                    : (data[index]?.label ?? ''),
                tickLabelInterval: (_value, index) =>
                  index % tickStep === 0 || index === data.length - 1,
                height: 32,
                tickLabelStyle: { fill: '#64748b', fontSize: 11 },
              },
            ]}
            yAxis={[
              {
                width: 60,
                valueFormatter: (value) => compactMoney.format(Number(value)),
                tickLabelStyle: { fill: '#64748b', fontSize: 11 },
              },
            ]}
            sx={{
              '& .MuiChartsGrid-line': { stroke: '#e2e8f0', strokeDasharray: '3 4' },
              '& .MuiLineChart-line[data-series="current-kpi"]': { strokeWidth: 3 },
              '& .MuiLineChart-line[data-series="previous-kpi"]': {
                strokeWidth: 2,
                strokeDasharray: '6 4',
              },
            }}
          >
            <ChartsGrid horizontal />
            <LinePlot />
            <ChartsXAxis axisId="period" disableTicks />
            <ChartsYAxis disableTicks disableLine />
            <ChartsTooltip trigger="axis" />
          </ChartsContainer>
        </div>
      )}
      {visible.length > 0 && (
        <details className="mt-2 border-t border-slate-100 pt-3 text-xs">
          <summary className="w-fit cursor-pointer rounded text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Xem số liệu lũy kế
          </summary>
          <div className="mt-3 max-h-64 overflow-auto">
            <table className="w-full text-left tabular-nums">
              <caption className="sr-only">KPI lũy kế và chênh lệch cùng kỳ</caption>
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th scope="col" className="p-2">
                    Đến ngày
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Kỳ này
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Kỳ trước
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Chênh lệch
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((point) => (
                  <tr key={point.period} className="border-b border-slate-100">
                    <td className="p-2">
                      {shortDate(point.to)}
                      <span className="block text-slate-500">{shortDate(point.previousTo)}</span>
                    </td>
                    <td className="p-2 text-right">
                      {formatCurrency(point.cumulativeProfitAmount ?? 0)}
                    </td>
                    <td className="p-2 text-right">
                      {formatCurrency(point.previousCumulativeProfitAmount ?? 0)}
                    </td>
                    <td className="p-2 text-right">
                      {point.difference === null ? '—' : formatCurrency(point.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
