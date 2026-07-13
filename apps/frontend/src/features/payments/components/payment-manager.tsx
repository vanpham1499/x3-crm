'use client';

import NextLink from 'next/link';
import { LinearProgress, MenuItem, TextField } from '@mui/material';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { formatQuotationPaymentContent } from '@/lib/quotation-utils';
import type { Payment, PaymentFilters } from '@/types/payment';

type PaymentManagerProps = {
  payments: Payment[];
  filters: PaymentFilters;
  isFetching: boolean;
  onFiltersChange: (filters: PaymentFilters) => void;
};

const statusLabels: Record<string, string> = {
  unmatched: 'Chờ đối soát',
  matched_quotation: 'Đã nhận diện báo phí',
  matched_project: 'Đã nhận diện dự án',
  partial: 'Chưa thu đủ',
  paid: 'Hoàn thành',
  overpaid: 'Thu thừa',
};

const reconciledStatusLabels: Record<string, string> = {
  unmatched: 'Chưa xác định báo phí',
  matched_quotation: 'Đã khớp báo phí',
  matched_project: 'Đã khớp dự án',
};

function formatCurrency(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
}

function statusClass(status?: string | null) {
  if (status === 'unmatched') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (status === 'overpaid') return 'bg-violet-50 text-violet-700 ring-violet-100';
  if (status === 'matched_project') return 'bg-sky-50 text-sky-700 ring-sky-100';
  if (status === 'matched_quotation') return 'bg-blue-50 text-blue-700 ring-blue-100';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

export function PaymentManager({
  payments,
  filters,
  isFetching,
  onFiltersChange,
}: PaymentManagerProps) {
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(
    payments,
    { resetKey: filters },
  );

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Thanh toán</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Thanh toán</span>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-slate-500">
          Giao dịch ngân hàng được webhook ghi nhận và tự đối chiếu với nội dung chuyển khoản của
          báo phí. Số tiền tại đây chính là doanh thu thực nhận.
        </p>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[220px_1fr]">
          <TextField
            select
            label="Trạng thái thu tiền"
            value={filters.status}
            onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="unmatched">Chờ đối soát</MenuItem>
            <MenuItem value="matched_quotation">Đã nhận diện báo phí</MenuItem>
            <MenuItem value="matched_project">Đã nhận diện dự án</MenuItem>
            <MenuItem value="partial">Chưa thu đủ</MenuItem>
            <MenuItem value="paid">Hoàn thành</MenuItem>
            <MenuItem value="overpaid">Thu thừa</MenuItem>
          </TextField>
        </div>

        <div className="relative w-full overflow-x-auto">
          {isFetching ? (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress />
            </div>
          ) : null}

          <table
            className={`w-full min-w-[1180px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-32 px-5 py-4">Ngày</th>
                <th className="w-40 px-5 py-4 text-right">Số tiền</th>
                <th className="w-56 px-5 py-4">Báo phí</th>
                <th className="w-56 px-5 py-4">Dự án</th>
                <th className="w-48 px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4">Nội dung ngân hàng</th>
                <th className="w-44 px-5 py-4">Mã giao dịch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm font-semibold text-slate-500"
                  >
                    Chưa có giao dịch
                  </td>
                </tr>
              ) : (
                pageItems.map((payment) => {
                  const paymentContent = formatQuotationPaymentContent(
                    payment.quotation?.quotationCode,
                  );

                  return (
                    <tr key={payment.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4 text-slate-600">
                        {payment.transactionDate || '-'}
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold tabular-nums text-slate-950">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-5 py-4">
                        {payment.quotation ? (
                          <>
                            <NextLink
                              href={`/quotations/${payment.quotation.id}`}
                              className="font-bold text-blue-700 hover:underline"
                            >
                              {payment.quotation.quotationCode || '-'}
                            </NextLink>
                            <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                              CK: {paymentContent || '-'}
                            </p>
                          </>
                        ) : (
                          <span className="font-semibold text-amber-700">Chưa xác định</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {payment.project ? (
                          <NextLink
                            href={`/projects/${payment.project.id}`}
                            className="block truncate font-semibold text-slate-900 hover:underline"
                          >
                            {payment.project.projectCode || '-'}
                          </NextLink>
                        ) : (
                          <p className="truncate font-semibold text-slate-500">-</p>
                        )}
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {payment.project?.projectName || ''}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(payment.status)}`}
                        >
                          {statusLabels[payment.status || ''] || payment.status || '-'}
                        </span>
                        <p className="mt-1.5 text-xs font-medium text-slate-400">
                          {reconciledStatusLabels[payment.reconciledStatus || ''] ||
                            payment.reconciledStatus ||
                            '-'}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <span
                          className="block truncate"
                          title={payment.transactionContent || ''}
                        >
                          {payment.transactionContent || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">
                        {payment.reference || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
