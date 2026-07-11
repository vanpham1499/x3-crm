'use client';

import { useState } from 'react';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  TextField,
} from '@mui/material';
import type { Payment, PaymentFilters } from '@/types/payment';
import type { Revenue } from '@/types/revenue';

type PaymentManagerProps = {
  payments: Payment[];
  filters: PaymentFilters;
  isFetching: boolean;
  onFiltersChange: (filters: PaymentFilters) => void;
  linkTarget: Payment | null;
  linkableRevenues: Revenue[];
  isLinkableRevenuesFetching: boolean;
  isLinking: boolean;
  onOpenLink: (payment: Payment) => void;
  onCloseLink: () => void;
  onConfirmLink: (revenueId: number | null) => void;
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
  linkTarget,
  linkableRevenues,
  isLinkableRevenuesFetching,
  isLinking,
  onOpenLink,
  onCloseLink,
  onConfirmLink,
}: PaymentManagerProps) {
  const [selectedRevenueId, setSelectedRevenueId] = useState('');

  const openLinkDialog = (payment: Payment) => {
    setSelectedRevenueId(payment.revenue?.id ? String(payment.revenue.id) : '');
    onOpenLink(payment);
  };

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

          <table className={`w-full min-w-[1320px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-32 px-5 py-4">Ngày</th>
                <th className="w-40 px-5 py-4 text-right">Số tiền</th>
                <th className="w-48 px-5 py-4">Báo giá</th>
                <th className="w-48 px-5 py-4">Dự án</th>
                <th className="w-40 px-5 py-4">Hợp đồng</th>
                <th className="w-40 px-5 py-4">Trạng thái</th>
                <th className="w-48 px-5 py-4">Doanh thu</th>
                <th className="px-5 py-4">Nội dung CK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
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
                    <td className="px-5 py-4">
                      {payment.projectId ? (
                        <button
                          type="button"
                          onClick={() => openLinkDialog(payment)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ring-1 transition hover:opacity-80"
                          title={payment.revenue ? 'Sửa liên kết doanh thu' : 'Gắn doanh thu'}
                        >
                          {payment.revenue ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-100">
                              <LinkRoundedIcon fontSize="inherit" />
                              {payment.revenue.revenueCode}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-500 ring-1 ring-slate-200">
                              <LinkOffRoundedIcon fontSize="inherit" />
                              Chưa gắn
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
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

      <Dialog open={Boolean(linkTarget)} onClose={isLinking ? undefined : onCloseLink} maxWidth="sm" fullWidth>
        <DialogTitle className="border-b border-slate-100 px-6 py-5">
          <p className="text-lg font-bold text-slate-950">Gắn doanh thu cho khoản thanh toán</p>
          <p className="mt-1 text-sm text-slate-500">
            {linkTarget?.transactionDate} · {formatCurrency(linkTarget?.amount)} · {linkTarget?.project?.projectName}
          </p>
        </DialogTitle>
        <DialogContent className="space-y-4 px-6 py-5">
          {isLinkableRevenuesFetching ? (
            <p className="text-sm text-slate-500">Đang tải danh sách doanh thu của dự án...</p>
          ) : linkableRevenues.length === 0 ? (
            <p className="text-sm text-slate-500">
              Dự án này chưa có bản ghi doanh thu nào. Hãy tạo doanh thu trước ở mục "Doanh thu".
            </p>
          ) : (
            <TextField
              fullWidth
              select
              label="Chọn doanh thu"
              value={selectedRevenueId}
              onChange={(event) => setSelectedRevenueId(event.target.value)}
            >
              <MenuItem value="">Không gắn</MenuItem>
              {linkableRevenues.map((revenue) => (
                <MenuItem key={revenue.id} value={String(revenue.id)}>
                  {revenue.revenueCode} — {formatCurrency(revenue.amountAfterVat)}
                </MenuItem>
              ))}
            </TextField>
          )}
        </DialogContent>
        <DialogActions className="border-t border-slate-100 px-6 py-4">
          <Button variant="outlined" onClick={onCloseLink} disabled={isLinking}>
            Hủy
          </Button>
          <Button
            type="button"
            variant="contained"
            disabled={isLinking}
            onClick={() => onConfirmLink(selectedRevenueId ? Number(selectedRevenueId) : null)}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            {isLinking ? 'Đang lưu...' : 'Lưu liên kết'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
