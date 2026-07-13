'use client';

import Link from 'next/link';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  TextField,
} from '@mui/material';
import { useState, type MouseEvent } from 'react';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import {
  getQuotationPaymentContent,
  QUOTATION_PAYMENT_STATUS_LABELS,
} from '@/lib/quotation-utils';
import type { Quotation, QuotationFilters } from '@/types/quotation';

type QuotationManagerProps = {
  quotations: Quotation[];
  filters: QuotationFilters;
  isFetching: boolean;
  isDeleting: boolean;
  onFiltersChange: (filters: QuotationFilters) => void;
  onDelete: (quotation: Quotation) => void;
};

function formatCurrency(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
}

function getMetadataValue(quotation: Quotation, key: string) {
  const value = quotation.metadata?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function getQuotationQrUrl(quotation: Quotation) {
  const bankCode = getMetadataValue(quotation, 'bankCode');
  const accountNo = getMetadataValue(quotation, 'bankAccountNo');
  const accountName = getMetadataValue(quotation, 'bankAccountName');

  const paymentContent = getQuotationPaymentContent(quotation);

  if (!paymentContent || !bankCode || !accountNo || !accountName) {
    return '';
  }

  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(Number(quotation.totalAmount) || 0))),
    addInfo: paymentContent,
    accountName,
  });

  return `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact2.png?${params.toString()}`;
}

const statusLabels: Record<string, string> = {
  draft: 'Nháp',
  sent: 'Đã gửi',
  won: 'Đã chốt',
  lost: 'Đã hủy',
};

function paymentStatusClass(status?: string | null) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (status === 'overpaid') return 'bg-violet-50 text-violet-700 ring-violet-100';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export function QuotationManager({
  quotations,
  filters,
  isFetching,
  isDeleting,
  onFiltersChange,
  onDelete,
}: QuotationManagerProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [qrTarget, setQrTarget] = useState<Quotation | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(
    quotations,
    { resetKey: filters },
  );

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, quotation: Quotation) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveQuotation(quotation);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveQuotation(null);
  };

  const updateFilters = (nextFilters: Partial<QuotationFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Báo giá</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Báo giá</span>
          </div>
        </div>

        <Button
          component={Link}
          href="/quotations/new"
          variant="contained"
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Thêm báo giá
        </Button>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[minmax(280px,1fr)_180px]">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm mã báo giá, lead, dịch vụ, ghi chú..."
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
            label="Trạng thái"
            value={filters.status}
            onChange={(event) => updateFilters({ status: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="draft">Nháp</MenuItem>
            <MenuItem value="sent">Đã gửi</MenuItem>
            <MenuItem value="won">Thắng</MenuItem>
            <MenuItem value="lost">Thua</MenuItem>
          </TextField>
        </div>

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table className={`w-full min-w-[1320px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-44 px-5 py-4">Mã báo giá</th>
                <th className="w-[260px] px-5 py-4">Lead / Khách hàng</th>
                <th className="w-52 px-5 py-4">Dịch vụ</th>
                <th className="w-32 px-5 py-4">Trạng thái</th>
                <th className="w-40 px-5 py-4 text-right">Tổng tiền</th>
                <th className="w-44 px-5 py-4">Thu tiền</th>
                <th className="w-36 px-5 py-4">Hiệu lực</th>
                <th className="w-20 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có báo giá
                  </td>
                </tr>
              ) : (
                pageItems.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-bold text-slate-950">{quotation.quotationCode || '-'}</td>
                    <td className="px-5 py-4">
                      {quotation.lead ? (
                        <Link href={`/leads/${quotation.lead.id}`} className="block truncate font-semibold text-slate-900 hover:underline">
                          {quotation.lead.customerName || '-'}
                        </Link>
                      ) : quotation.customer ? (
                        <Link href={`/customers/${quotation.customer.id}`} className="block truncate font-semibold text-slate-900 hover:underline">
                          {quotation.customer.customerName || '-'}
                        </Link>
                      ) : (
                        <p className="truncate font-semibold text-slate-900">-</p>
                      )}
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                        {quotation.lead?.leadCode || quotation.customer?.customerCode || '-'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <span className="block truncate" title={quotation.serviceName || ''}>
                        {quotation.serviceCode ? `${quotation.serviceCode} - ${quotation.serviceName || ''}` : quotation.serviceName || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {statusLabels[quotation.status || ''] || quotation.status || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-950">
                      {formatCurrency(quotation.totalAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${paymentStatusClass(quotation.paymentStatus)}`}
                      >
                        {QUOTATION_PAYMENT_STATUS_LABELS[quotation.paymentStatus || ''] ||
                          quotation.paymentStatus ||
                          'Chưa thanh toán'}
                      </span>
                      <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-500">
                        {formatCurrency(quotation.paidAmount)} / {formatCurrency(quotation.totalAmount)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{quotation.validUntil || '-'}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <IconButton size="small" title="Tác vụ" onClick={(event) => openActionMenu(event, quotation)}>
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

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          onClick={() => {
            setQrTarget(activeQuotation);
            closeActionMenu();
          }}
        >
          <QrCode2RoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem QR thanh toán
        </MenuItem>
        <MenuItem
          component={Link}
          href={activeQuotation ? `/quotations/${activeQuotation.id}` : '/quotations'}
          onClick={closeActionMenu}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          className="text-rose-600"
          disabled={isDeleting}
          onClick={() => {
            setDeleteTarget(activeQuotation);
            closeActionMenu();
          }}
        >
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(qrTarget)} onClose={() => setQrTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle className="border-b border-slate-100 px-6 py-5">
          <p className="text-lg font-bold text-slate-950">QR thanh toán</p>
          <p className="mt-1 text-sm text-slate-500">{qrTarget?.quotationCode || '-'}</p>
        </DialogTitle>
        <DialogContent className="px-6 py-5">
          {qrTarget && getQuotationQrUrl(qrTarget) ? (
            <div className="grid gap-5 sm:grid-cols-[180px,minmax(0,1fr)]">
              <img
                src={getQuotationQrUrl(qrTarget)}
                alt="Mã VietQR thanh toán báo phí"
                className="h-44 w-44 rounded-xl border border-slate-100 bg-white object-contain"
              />
              <div className="min-w-0 text-sm text-slate-600">
                <p className="font-bold text-slate-950">Thông tin chuyển khoản</p>
                <div className="mt-3 space-y-2">
                  <p>
                    <span className="font-bold text-slate-950">Ngân hàng:</span>{' '}
                    {getMetadataValue(qrTarget, 'bankName') || getMetadataValue(qrTarget, 'bankCode')}
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">Số tài khoản:</span>{' '}
                    <span className="tabular-nums">{getMetadataValue(qrTarget, 'bankAccountNo')}</span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">Chủ tài khoản:</span>{' '}
                    {getMetadataValue(qrTarget, 'bankAccountName')}
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">Số tiền:</span>{' '}
                    <span className="font-extrabold text-emerald-700">
                      {formatCurrency(qrTarget.totalAmount)}
                    </span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">Nội dung:</span>{' '}
                    <span className="font-mono font-extrabold text-slate-950">
                      {getQuotationPaymentContent(qrTarget)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-500">
              Báo giá này chưa có đủ thông tin tài khoản nhận tiền để tạo QR.
            </p>
          )}
        </DialogContent>
        <DialogActions className="border-t border-slate-100 px-6 py-4">
          <Button variant="outlined" onClick={() => setQrTarget(null)}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa báo giá?"
        description={`Bạn có chắc muốn xóa báo giá "${deleteTarget?.quotationCode || ''}"?`}
        confirmText="Xóa báo giá"
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
