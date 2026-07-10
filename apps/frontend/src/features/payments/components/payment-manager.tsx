'use client';

import { MenuItem, TextField, LinearProgress } from '@mui/material';
import type { Payment, PaymentFilters } from '@/types/payment';

type PaymentManagerProps = {
  payments: Payment[];
  filters: PaymentFilters;
  isFetching: boolean;
  onFiltersChange: (filters: PaymentFilters) => void;
};

const statusLabels: Record<string, string> = {
  unmatched: 'Chờ kế toán xử lý',
  matched_quotation: 'Đã khớp báo giá',
  matched_project: 'Đã khớp dự án',
  partial: 'Thanh toán thiếu',
  paid: 'Đã thanh toán',
  overpaid: 'Thanh toán thừa',
};

function formatCurrency(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
}

function statusClass(status?: string | null) {
  if (status === 'unmatched') return 'bg-amber-50 text-amber-700';
  if (status === 'matched_project' || status === 'paid') return 'bg-emerald-50 text-emerald-700';
  if (status === 'matched_quotation') return 'bg-sky-50 text-sky-700';
  if (status === 'partial' || status === 'overpaid') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

export function PaymentManager({
  payments,
  filters,
  isFetching,
  onFiltersChange,
}: PaymentManagerProps) {
  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Thanh toán</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Thanh toán</span>
        </div>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[220px_1fr]">
          <TextField
            select
            label="Trạng thái"
            value={filters.status}
            onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="unmatched">Chờ xử lý</MenuItem>
            <MenuItem value="matched_quotation">Đã khớp báo giá</MenuItem>
            <MenuItem value="matched_project">Đã khớp dự án</MenuItem>
            <MenuItem value="partial">Thanh toán thiếu</MenuItem>
            <MenuItem value="paid">Đã thanh toán</MenuItem>
            <MenuItem value="overpaid">Thanh toán thừa</MenuItem>
          </TextField>
        </div>

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress />
            </div>
          )}

          <table className={`w-full min-w-[1180px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-32 px-5 py-4">Ngày</th>
                <th className="w-40 px-5 py-4 text-right">Số tiền</th>
                <th className="w-52 px-5 py-4">Báo giá</th>
                <th className="w-52 px-5 py-4">Dự án</th>
                <th className="w-44 px-5 py-4">Hợp đồng</th>
                <th className="w-44 px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4">Nội dung CK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có giao dịch
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-slate-600">{payment.transactionDate || '-'}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-950">{formatCurrency(payment.amount)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{payment.quotation?.quotationCode || '-'}</td>
                    <td className="px-5 py-4">
                      <p className="truncate font-semibold text-slate-900">{payment.project?.projectCode || '-'}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{payment.project?.projectName || ''}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{payment.contract?.contractNo || '-'}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${statusClass(payment.status)}`}>
                        {statusLabels[payment.status || ''] || payment.status || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className="block truncate" title={payment.transactionContent || ''}>
                        {payment.transactionContent || '-'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
