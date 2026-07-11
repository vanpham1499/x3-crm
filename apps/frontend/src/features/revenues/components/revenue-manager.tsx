'use client';

import Link from 'next/link';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Button, IconButton, InputAdornment, LinearProgress, Menu, MenuItem, TextField } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import {
  REVENUE_INVOICE_STATUS_LABELS,
  REVENUE_PAYMENT_STATUS_LABELS,
  formatRevenueMonth,
} from '@/lib/revenue-utils';
import { formatCurrency } from '@/lib/utils';
import type { Revenue, RevenueFilters } from '@/types/revenue';

type RevenueManagerProps = {
  revenues: Revenue[];
  filters: RevenueFilters;
  isFetching: boolean;
  isDeleting: boolean;
  onFiltersChange: (filters: RevenueFilters) => void;
  onDelete: (revenue: Revenue) => void;
};

function paymentStatusClass(status?: string | null) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function invoiceStatusClass(status?: string | null) {
  return status === 'issued'
    ? 'bg-sky-50 text-sky-700 ring-sky-100'
    : 'bg-slate-100 text-slate-600 ring-slate-200';
}

export function RevenueManager({
  revenues,
  filters,
  isFetching,
  isDeleting,
  onFiltersChange,
  onDelete,
}: RevenueManagerProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeRevenue, setActiveRevenue] = useState<Revenue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Revenue | null>(null);

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, revenue: Revenue) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveRevenue(revenue);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveRevenue(null);
  };

  const updateFilters = (nextFilters: Partial<RevenueFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const totalReceived = revenues.reduce((sum, revenue) => sum + (Number(revenue.actualReceivedAmount) || 0), 0);

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Doanh thu</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Doanh thu</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-slate-400">Tổng thực nhận</p>
            <p className="text-lg font-extrabold text-slate-950">{formatCurrency(totalReceived)}</p>
          </div>
          <Button
            component={Link}
            href="/revenues/new"
            variant="contained"
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            Ghi nhận doanh thu
          </Button>
        </div>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[minmax(260px,1fr)_180px_180px]">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm mã doanh thu, ghi chú..."
            value={filters.keyword}
            onChange={(event) => updateFilters({ keyword: event.target.value })}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            select
            label="Thanh toán"
            value={filters.payment_status}
            onChange={(event) => updateFilters({ payment_status: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {Object.entries(REVENUE_PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Hóa đơn"
            value={filters.invoice_status}
            onChange={(event) => updateFilters({ invoice_status: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {Object.entries(REVENUE_INVOICE_STATUS_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </div>

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table className={`w-full min-w-[1180px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-40 px-5 py-4">Mã doanh thu</th>
                <th className="w-[260px] px-5 py-4">Dự án / Khách hàng</th>
                <th className="w-32 px-5 py-4">Tháng</th>
                <th className="w-36 px-5 py-4 text-right">Doanh thu</th>
                <th className="w-36 px-5 py-4 text-right">Thực nhận</th>
                <th className="w-32 px-5 py-4">Thanh toán</th>
                <th className="w-32 px-5 py-4">Hóa đơn</th>
                <th className="w-20 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {revenues.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có doanh thu nào
                  </td>
                </tr>
              ) : (
                revenues.map((revenue) => (
                  <tr key={revenue.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-bold text-slate-950">{revenue.revenueCode || '-'}</td>
                    <td className="px-5 py-4">
                      {revenue.project ? (
                        <Link href={`/projects/${revenue.project.id}`} className="block truncate font-semibold text-slate-900 hover:underline">
                          {revenue.project.projectName || '-'}
                        </Link>
                      ) : (
                        <p className="truncate font-semibold text-slate-900">-</p>
                      )}
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                        {revenue.project?.customer?.customerName || revenue.project?.projectCode || '-'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatRevenueMonth(revenue.revenueMonth)}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-950">
                      {formatCurrency(Number(revenue.amountAfterVat) || 0)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                      {formatCurrency(Number(revenue.actualReceivedAmount) || 0)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${paymentStatusClass(revenue.paymentStatus)}`}
                      >
                        {REVENUE_PAYMENT_STATUS_LABELS[revenue.paymentStatus || ''] || revenue.paymentStatus || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${invoiceStatusClass(revenue.invoiceStatus)}`}
                      >
                        {REVENUE_INVOICE_STATUS_LABELS[revenue.invoiceStatus || ''] || revenue.invoiceStatus || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <IconButton size="small" title="Tác vụ" onClick={(event) => openActionMenu(event, revenue)}>
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          component={Link}
          href={activeRevenue ? `/revenues/${activeRevenue.id}` : '/revenues'}
          onClick={closeActionMenu}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          className="text-rose-600"
          disabled={isDeleting}
          onClick={() => {
            setDeleteTarget(activeRevenue);
            closeActionMenu();
          }}
        >
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa doanh thu?"
        description={`Bạn có chắc muốn xóa doanh thu "${deleteTarget?.revenueCode || ''}"?`}
        confirmText="Xóa doanh thu"
        loading={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
