'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Checkbox, FormControlLabel } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { formatCurrency, formatDate } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import type {
  DashboardCashComparison,
  DashboardComparisonPoint,
  DashboardProjectProfit,
} from '@/types/dashboard';

const card = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const compact = (n: number) =>
  new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const range = (from: string, to: string | null) =>
  to ? `${formatDate(from)} – ${formatDate(to)}` : 'Kỳ chưa bắt đầu';

function ComparisonChart({
  points,
  showQuotation = false,
  monthly = false,
  previousLabel = 'Cùng kỳ trước',
}: {
  points: DashboardComparisonPoint[];
  showQuotation?: boolean;
  monthly?: boolean;
  previousLabel?: string;
}) {
  const data = points;
  const single = data.filter((p) => p.current !== null).length <= 1;
  return (
    <div className="min-h-[280px] min-w-0 pb-3" aria-label="Biểu đồ lũy kế kỳ này và kỳ trước">
      <LineChart
        height={280}
        margin={{ top: 20, right: 16, bottom: 8, left: 0 }}
        xAxis={[
          {
            scaleType: 'point',
            data: data.map((p) => p.label),
            tickLabelInterval: (_v, i) =>
              i % Math.max(1, Math.ceil(data.length / 8)) === 0 || i === data.length - 1,
          },
        ]}
        yAxis={[{ width: 65, valueFormatter: compact }]}
        series={[
          {
            id: 'current',
            label: monthly ? 'Kỳ này (theo tháng ghi nhận)' : 'Thu ròng kỳ này',
            data: data.map((p) => p.current),
            color: siteConfig.brand.primary,
            showMark: single,
            curve: 'linear' as const,
            valueFormatter: (v) => (v === null ? 'Chưa có dữ liệu' : formatCurrency(v)),
          },
          {
            id: 'previous',
            label: previousLabel,
            data: data.map((p) => p.previous),
            color: siteConfig.brand.blue,
            showMark: single,
            curve: 'linear' as const,
            valueFormatter: (v) => (v === null ? 'Chưa có dữ liệu' : formatCurrency(v)),
          },
          ...(showQuotation
            ? [
                {
                  id: 'quotation',
                  label: 'Báo phí kỳ này',
                  data: data.map((p) => p.quotation ?? null),
                  color: '#94a3b8',
                  showMark: false,
                  curve: 'linear' as const,
                  valueFormatter: (v: number | null) => (v === null ? '' : formatCurrency(v)),
                },
              ]
            : []),
        ]}
        grid={{ horizontal: true }}
        sx={{
          '& [data-series-id="previous"]': { strokeDasharray: '6 5' },
          '& .MuiChartsGrid-line': { stroke: '#e2e8f0', strokeDasharray: '3 4' },
        }}
      />
    </div>
  );
}

function Metric({
  label,
  amount,
  onClick,
}: {
  label: string;
  amount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-lg p-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span className="block text-xs text-slate-500">{label}</span>
      <span
        className={`mt-1 block text-base font-bold tabular-nums ${amount < 0 ? 'text-rose-700' : 'text-slate-900'}`}
        title={formatCurrency(amount)}
      >
        {compact(amount)} đ
      </span>
    </button>
  );
}

export function CashComparisonCard({ data }: { data: DashboardCashComparison }) {
  const [showQuotation, setShowQuotation] = useState(false);
  const [detail, setDetail] = useState<'received' | 'refund' | 'current' | 'previous' | null>(null);
  const [page, setPage] = useState(1);
  const open = (value: typeof detail) => {
    setPage(1);
    setDetail(value);
  };
  const rows = data.details.filter((r) =>
    detail === 'previous'
      ? r.side === 'previous'
      : r.side === 'current' && (detail === 'current' || r.kind === detail),
  );
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Dòng tiền thu lũy kế</h2>
          <p className="mt-1 text-xs text-slate-500">
            Lũy kế {range(data.from, data.to)} · So với {range(data.previousFrom, data.previousTo)}
          </p>
        </div>
        <DialogActionButton onClick={() => open('current')}>Đối soát</DialogActionButton>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
        <Metric label="Đã thu" amount={data.received} onClick={() => open('received')} />
        <Metric label="Hoàn tiền" amount={data.refund} onClick={() => open('refund')} />
        <Metric label="Thu ròng" amount={data.net} onClick={() => open('current')} />
        <Metric label="Cùng kỳ trước" amount={data.previousNet} onClick={() => open('previous')} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={data.difference < 0 ? 'text-rose-700' : 'text-primary'}>
          {data.to
            ? `${data.difference > 0 ? '+' : ''}${formatCurrency(data.difference)}${data.changeRate === null ? ' · Kỳ trước bằng 0' : ` (${data.changeRate > 0 ? '+' : ''}${data.changeRate.toLocaleString('vi-VN')}%)`}`
            : 'Kỳ chưa bắt đầu'}
        </span>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={showQuotation}
              onChange={(_e, checked) => setShowQuotation(checked)}
            />
          }
          label={<span className="text-xs">Hiện báo phí</span>}
        />
      </div>
      <ComparisonChart points={data.points} showQuotation={showQuotation} />
      <p className="text-xs text-slate-500">
        Tiền đã phân bổ vào báo phí, gồm ngân sách và VAT; chưa trừ chi phí.
      </p>
      <AppDetailDialog
        open={detail !== null}
        title="Đối soát tiền thu"
        subtitle={
          detail === 'previous'
            ? range(data.previousFrom, data.previousTo)
            : range(data.from, data.to)
        }
        onClose={() => setDetail(null)}
      >
        <AppDataTable
          columns={[
            { key: 'date', label: 'Ngày giao dịch' },
            { key: 'reference', label: 'Báo phí' },
            { key: 'kind', label: 'Loại' },
            { key: 'amount', label: 'Số tiền', className: 'text-right' },
          ]}
          isEmpty={!rows.length}
          emptyText="Chưa có giao dịch trong kỳ"
        >
          {rows.slice((page - 1) * 20, page * 20).map((r, i) => (
            <tr key={`${r.side}-${r.date}-${i}`}>
              <td className="px-4 py-3 text-sm">{formatDate(r.date)}</td>
              <td className="px-4 py-3 text-sm">{r.reference}</td>
              <td className="px-4 py-3 text-sm">{r.kind === 'refund' ? 'Hoàn tiền' : 'Đã thu'}</td>
              <td className="px-4 py-3 text-right text-sm tabular-nums">
                {r.kind === 'refund' ? '−' : '+'}
                {formatCurrency(r.amount)}
              </td>
            </tr>
          ))}
        </AppDataTable>
        <TablePaginationBar
          page={page}
          totalPages={Math.max(1, Math.ceil(rows.length / 20))}
          totalItems={rows.length}
          pageSize={20}
          onPageChange={setPage}
        />
      </AppDetailDialog>
    </section>
  );
}

export function ProjectProfitCard({ data }: { data: DashboardProjectProfit }) {
  const [detail, setDetail] = useState<'revenue' | 'cost' | 'all' | 'previous' | 'review' | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const open = (value: typeof detail) => {
    setPage(1);
    setDetail(value);
  };
  const rows =
    detail === 'review'
      ? data.review
      : data.details.filter(
          (r) =>
            r.period &&
            (detail === 'previous'
              ? r.period >= data.previousFrom && r.period <= data.previousTo
              : r.period >= data.from &&
                r.period <= data.to &&
                (detail === 'all' || r.kind === detail)),
        );
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Lợi nhuận dự án</h2>
          <p className="mt-1 text-xs text-slate-500">
            Kỳ ghi nhận {data.from} – {data.to} · Đối chiếu {data.previousFrom} – {data.previousTo}
          </p>
        </div>
        <DialogActionButton onClick={() => open('all')}>Đối soát</DialogActionButton>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
        <Metric
          label="Doanh thu dịch vụ trước VAT"
          amount={data.revenue}
          onClick={() => open('revenue')}
        />
        <Metric
          label="Chi phí trực tiếp ghi nhận"
          amount={data.cost}
          onClick={() => open('cost')}
        />
        <Metric label="Lợi nhuận đã ghi nhận" amount={data.profit} onClick={() => open('all')} />
        <Metric
          label="Kỳ trước (theo tháng)"
          amount={data.previousProfit}
          onClick={() => open('previous')}
        />
      </div>
      <div className="my-3 flex flex-wrap items-center gap-3 text-xs">
        {data.comparable ? (
          <span className={data.profit < data.previousProfit ? 'text-rose-700' : 'text-primary'}>
            {formatCurrency(data.profit - data.previousProfit)} ·{' '}
            {data.changeRate === null
              ? 'Kỳ trước bằng 0'
              : `${data.changeRate > 0 ? '+' : ''}${data.changeRate.toLocaleString('vi-VN')}%`}
          </span>
        ) : (
          <span className="text-amber-800">
            Tạm tính ·{' '}
            {data.partial
              ? 'Kỳ chưa kết thúc; đối chiếu theo tháng, chưa so sánh cùng ngày.'
              : 'Còn nguồn chưa đối soát; chưa tính tăng/giảm.'}
          </span>
        )}
        {data.review.length > 0 && (
          <button
            type="button"
            className="rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-800 underline-offset-2 hover:underline"
            onClick={() => open('review')}
          >
            {data.review.length} khoản chưa ghi nhận
          </button>
        )}
      </div>
      {data.details.length ? (
        <ComparisonChart
          points={data.points}
          monthly
          previousLabel={data.partial ? 'Kỳ trước (đủ tháng)' : 'Kỳ trước'}
        />
      ) : (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 p-5 text-center">
          <p className="text-sm font-semibold text-slate-700">
            {data.review.length
              ? 'Chưa đủ dữ liệu lợi nhuận'
              : 'Chưa có phát sinh được ghi nhận trong kỳ'}
          </p>
          {data.review.length > 0 && (
            <>
              <p className="text-sm text-slate-500">
                {data.review.length} khoản chờ xác nhận hoặc kiểm tra kỳ ghi nhận.
              </p>
              <DialogActionButton onClick={() => open('review')}>
                Xem kỳ ghi nhận
              </DialogActionButton>
            </>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Loại ngân sách, cọc và MKM. Chi phí theo sổ ghi nhận; không trừ lại khi thanh toán.
      </p>
      <AppDetailDialog
        open={detail !== null}
        title={detail === 'review' ? 'Các khoản chưa ghi nhận' : 'Đối soát lợi nhuận dự án'}
        subtitle="Các khoản đã xác nhận và chưa xác nhận được tách riêng"
        maxWidth="lg"
        onClose={() => setDetail(null)}
        actions={
          <Button component={Link} href="/costs/partner-finance" size="small">
            Mở sổ ghi nhận
          </Button>
        }
      >
        <AppDataTable
          columns={[
            { key: 'project', label: 'Dự án' },
            { key: 'source', label: 'Nguồn' },
            { key: 'period', label: 'Kỳ ghi nhận' },
            { key: 'amount', label: 'Số tiền', className: 'text-right' },
          ]}
          isEmpty={!rows.length}
          emptyText="Không có khoản phù hợp"
        >
          {rows.slice((page - 1) * 20, page * 20).map((r, i) => (
            <tr key={`${r.reference}-${r.period}-${i}`}>
              <td className="px-4 py-3 text-sm">
                <Link className="font-medium text-primary" href={`/projects/${r.projectId}`}>
                  {r.project}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm">
                <Link
                  className="font-medium text-primary hover:underline"
                  href={`/costs/partner-finance?project=${r.projectId}`}
                >
                  {r.reference}
                </Link>
                <span className="block text-xs text-slate-500">
                  {r.kind === 'cost' ? 'Chi phí' : 'Doanh thu'}
                  {r.reason ? ` · ${r.reason}` : ''}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">{r.period ?? 'Chưa xác nhận'}</td>
              <td className="px-4 py-3 text-right text-sm tabular-nums">
                {r.amount === null ? 'Cần đối soát' : formatCurrency(r.amount)}
              </td>
            </tr>
          ))}
        </AppDataTable>
        <TablePaginationBar
          page={page}
          totalPages={Math.max(1, Math.ceil(rows.length / 20))}
          totalItems={rows.length}
          pageSize={20}
          onPageChange={setPage}
        />
      </AppDetailDialog>
    </section>
  );
}
