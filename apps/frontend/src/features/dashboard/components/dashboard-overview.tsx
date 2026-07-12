'use client';

import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/shell/page-header';
import dashboardData from '../data/dashboard.json';

const currencyFormatter = new Intl.NumberFormat('vi-VN');

function formatValue(value: number, suffix?: string) {
  return `${currencyFormatter.format(value)}${suffix ? ` ${suffix}` : ''}`;
}

function formatMillion(value: number) {
  return `${currencyFormatter.format(value)}M`;
}

export function DashboardOverview() {
  const totalServiceRevenue = dashboardData.serviceRevenue.reduce(
    (sum, item) => sum + item.value,
    0,
  );

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Dashboard"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Tổng quan' }]}
      />

      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardData.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60"
            >
              <p className="text-sm font-bold text-slate-600">{stat.label}</p>
              <p className="mt-3 text-3xl font-extrabold tracking-normal text-slate-950">
                {formatValue(stat.value, stat.suffix)}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-sm font-bold text-emerald-500">
                <TrendingUpRoundedIcon className="text-[18px]" />
                <span>+ {stat.change}%</span>
                <span className="font-semibold text-slate-400">so với tháng trước</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
            <h2 className="text-base font-extrabold text-slate-950">Doanh thu theo tháng</h2>
            <div className="mt-5 h-[310px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.monthlyRevenue} barGap={4}>
                  <CartesianGrid stroke="#edf2f7" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    formatter={(value: number) => [formatMillion(value), 'Doanh thu']}
                    contentStyle={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                    }}
                  />
                  <Bar dataKey="lastYear" name="2023" fill="#9bbcff" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="currentYear" name="2024" fill="#2f73df" radius={[6, 6, 0, 0]} />
                  <Bar
                    dataKey="serviceA"
                    name="Dịch vụ khác"
                    fill="#f6b044"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-6 text-sm font-bold text-slate-500">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#9bbcff]" />
                2023
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#2f73df]" />
                2024
              </span>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
            <h2 className="text-base font-extrabold text-slate-950">
              Tỷ lệ doanh thu theo dịch vụ
            </h2>
            <div className="mt-4 grid min-h-[330px] items-center gap-6 md:grid-cols-[1fr_180px] xl:grid-cols-[1fr_170px]">
              <div className="relative h-[270px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.serviceRevenue}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={72}
                      outerRadius={112}
                      paddingAngle={1}
                      stroke="none"
                    >
                      {dashboardData.serviceRevenue.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatMillion(value), 'Doanh thu']}
                      contentStyle={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="text-xl font-extrabold text-slate-950">
                    {formatMillion(totalServiceRevenue)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {dashboardData.serviceRevenue.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 text-sm font-bold text-slate-600"
                  >
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
