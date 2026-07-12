'use client';

import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { getQuotationPaymentContent, QUOTATION_PAYMENT_STATUS_LABELS } from '@/lib/quotation-utils';
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

function quotationStatusClass(status?: string | null) {
  if (status === 'won') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'sent') return 'bg-sky-50 text-sky-700 ring-sky-100';
  if (status === 'lost') return 'bg-rose-50 text-rose-700 ring-rose-100';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

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
      <PageHeader
        title="Báo giá"
        action={{ label: 'Thêm báo giá', href: '/quotations/new', icon: <AddRoundedIcon /> }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(280px,1fr)_176px]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm mã báo giá, lead, dịch vụ, ghi chú..."
            value={filters.keyword}
            onChange={(value) => updateFilters({ keyword: value })}
          />

          <CompactSelectField
            label="Trạng thái"
            value={filters.status}
            options={[
              { value: 'draft', label: 'Nháp' },
              { value: 'sent', label: 'Đã gửi' },
              { value: 'won', label: 'Đã chốt' },
              { value: 'lost', label: 'Đã hủy' },
            ]}
            onChange={(value) => updateFilters({ status: value })}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'quotation',
              label: 'Báo giá',
              className: 'sticky left-0 z-20 w-48 bg-slate-100',
            },
            { key: 'customer', label: 'Khách hàng', className: 'w-[250px]' },
            { key: 'project', label: 'Dự án', className: 'w-[230px]' },
            { key: 'service', label: 'Dịch vụ', className: 'w-[230px]' },
            { key: 'total', label: 'Tổng báo', className: 'w-40 text-right' },
            { key: 'paid', label: 'Đã thu', className: 'w-40 text-right' },
            { key: 'status', label: 'Trạng thái', className: 'w-44' },
            { key: 'actions', className: 'w-36' },
          ]}
          isLoading={isFetching}
          isEmpty={quotations.length === 0}
          emptyText="Chưa có báo giá"
          minWidthClassName="min-w-[1420px]"
        >
          {quotations.map((quotation) => {
            const partyCode = quotation.lead?.leadCode || quotation.customer?.customerCode || '';
            const partyName =
              quotation.lead?.customerName || quotation.customer?.customerName || '-';
            const partyHref = quotation.lead
              ? `/leads/${quotation.lead.id}`
              : quotation.customer
                ? `/customers/${quotation.customer.id}`
                : '';
            const totalAmount = Number(quotation.totalAmount) || 0;
            const paidAmount = Number(quotation.paidAmount) || 0;
            const outstandingAmount =
              quotation.outstandingAmount === null || quotation.outstandingAmount === undefined
                ? Math.max(0, totalAmount - paidAmount)
                : Math.max(0, Number(quotation.outstandingAmount) || 0);

            return (
              <tr key={quotation.id} className="group hover:bg-slate-50/80">
                <td className="sticky left-0 z-10 bg-white px-3 py-4 group-hover:bg-slate-50">
                  <Link
                    href={`/quotations/${quotation.id}`}
                    className="block truncate font-bold text-primary hover:underline"
                    title={quotation.quotationCode || ''}
                  >
                    {quotation.quotationCode || '-'}
                  </Link>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {quotation.validUntil
                      ? `Hiệu lực ${formatDate(quotation.validUntil)}`
                      : 'Không giới hạn'}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <div className="flex min-w-0 items-center gap-2">
                    {partyCode ? (
                      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        {partyCode}
                      </span>
                    ) : null}
                    {partyHref ? (
                      <Link
                        href={partyHref}
                        className="min-w-0 truncate font-semibold text-slate-950 hover:text-primary hover:underline"
                        title={partyName}
                      >
                        {partyName}
                      </Link>
                    ) : (
                      <span className="truncate font-semibold text-slate-950">{partyName}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-4">
                  {quotation.project ? (
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${quotation.project.id}`}
                        className="block truncate font-bold text-sky-700 hover:underline"
                        title={quotation.project.projectCode || ''}
                      >
                        {quotation.project.projectCode || '-'}
                      </Link>
                      <p
                        className="mt-1 truncate text-xs font-medium text-slate-500"
                        title={quotation.project.projectName || ''}
                      >
                        {quotation.project.projectName || '-'}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400">Chưa gắn dự án</span>
                  )}
                </td>
                <td className="px-3 py-4">
                  <div className="flex min-w-0 items-center gap-2">
                    {quotation.serviceCode ? (
                      <span className="shrink-0 rounded-md bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-100">
                        {quotation.serviceCode}
                      </span>
                    ) : null}
                    <span
                      className="min-w-0 truncate font-medium text-slate-700"
                      title={quotation.serviceName || ''}
                    >
                      {quotation.serviceName || '-'}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-4 text-right font-extrabold tabular-nums text-slate-950">
                  {formatCurrency(totalAmount)}
                </td>
                <td className="px-3 py-4 text-right">
                  <p className="font-extrabold tabular-nums text-emerald-700">
                    {formatCurrency(paidAmount)}
                  </p>
                  <p className="mt-1 text-xs font-medium tabular-nums text-slate-500">
                    Còn {formatCurrency(outstandingAmount)}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <div className="flex flex-col items-start gap-1.5">
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${quotationStatusClass(quotation.status)}`}
                    >
                      {statusLabels[quotation.status || ''] || quotation.status || '-'}
                    </span>
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${paymentStatusClass(quotation.paymentStatus)}`}
                    >
                      {QUOTATION_PAYMENT_STATUS_LABELS[quotation.paymentStatus || ''] ||
                        quotation.paymentStatus ||
                        'Chưa thanh toán'}
                    </span>
                  </div>
                </td>
                <td className="py-4">
                  <div className="flex items-center justify-end gap-1 pr-3">
                    <IconButton
                      size="small"
                      title="Xem QR thanh toán"
                      onClick={() => setQrTarget(quotation)}
                    >
                      <QrCode2RoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      component={Link}
                      href={`/quotations/${quotation.id}`}
                      size="small"
                      title="Chỉnh sửa báo giá"
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Tác vụ"
                      onClick={(event) => openActionMenu(event, quotation)}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </AppDataTable>

        <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
          Hiển thị <strong className="text-slate-950">{quotations.length}</strong> báo giá
        </div>
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

      <AppDetailDialog
        open={Boolean(qrTarget)}
        title="QR thanh toán"
        eyebrow={qrTarget?.quotationCode || undefined}
        subtitle={
          qrTarget?.customer?.customerName ||
          qrTarget?.lead?.customerName ||
          'Thông tin chuyển khoản'
        }
        maxWidth="sm"
        onClose={() => setQrTarget(null)}
        actions={
          qrTarget ? (
            <DialogActionButton href={`/quotations/${qrTarget.id}`} startIcon={<EditRoundedIcon />}>
              Chỉnh sửa
            </DialogActionButton>
          ) : null
        }
      >
        <div className="p-5">
          {qrTarget && getQuotationQrUrl(qrTarget) ? (
            <div className="grid gap-5 sm:grid-cols-[208px,minmax(0,1fr)] sm:items-start">
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={getQuotationQrUrl(qrTarget)}
                  alt="Mã VietQR thanh toán báo phí"
                  className="h-48 w-48 rounded-lg bg-white object-contain"
                />
              </div>

              <div className="min-w-0 space-y-3">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Số tiền thanh toán
                  </p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-emerald-800">
                    {formatCurrency(qrTarget.totalAmount)}
                  </p>
                </div>

                <dl className="overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
                  <div className="grid grid-cols-[96px,minmax(0,1fr)] gap-3 border-b border-slate-100 px-3 py-2.5">
                    <dt className="font-medium text-slate-500">Ngân hàng</dt>
                    <dd className="truncate text-right font-bold text-slate-900">
                      {getMetadataValue(qrTarget, 'bankName') ||
                        getMetadataValue(qrTarget, 'bankCode')}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[96px,minmax(0,1fr)] gap-3 border-b border-slate-100 px-3 py-2.5">
                    <dt className="font-medium text-slate-500">Số tài khoản</dt>
                    <dd className="truncate text-right font-bold tabular-nums text-slate-900">
                      {getMetadataValue(qrTarget, 'bankAccountNo')}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[96px,minmax(0,1fr)] gap-3 px-3 py-2.5">
                    <dt className="font-medium text-slate-500">Chủ tài khoản</dt>
                    <dd className="truncate text-right font-bold text-slate-900">
                      {getMetadataValue(qrTarget, 'bankAccountName')}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-lg border border-primary/20 bg-emerald-50/60 px-3.5 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Nội dung chuyển khoản
                  </p>
                  <p className="mt-1.5 select-all break-all font-mono text-base font-extrabold text-primary">
                    {getQuotationPaymentContent(qrTarget)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-600">
                Báo giá này chưa có đủ thông tin tài khoản nhận tiền để tạo QR.
              </p>
            </div>
          )}
        </div>
      </AppDetailDialog>

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
