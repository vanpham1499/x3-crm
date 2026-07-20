'use client';

import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { canCreateQuotation, canDeleteQuotation, canEditQuotation } from '@/lib/ownership';
import { getQuotationPaymentContent, QUOTATION_PAYMENT_STATUS_LABELS } from '@/lib/quotation-utils';
import type { Quotation, QuotationFilters } from '@/types/quotation';
import type { User } from '@/types/user';
import { QuotationPreviewDialog } from './quotation-preview-dialog';

type QuotationManagerProps = {
  quotations: Quotation[];
  filters: QuotationFilters;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isFetching: boolean;
  isDeleting: boolean;
  currentUser: User | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
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
  draft: 'Báo phí',
  won: 'Đã thanh toán',
};

function quotationStatusClass(status?: string | null) {
  if (status === 'won') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  return 'bg-sky-50 text-sky-700 ring-sky-100';
}

function getPartyIdentity(code?: string | null, name?: string | null) {
  const normalizedCode = code?.trim() || '';
  const normalizedName = name?.trim() || '';

  if (!normalizedCode) return normalizedName || '-';
  if (!normalizedName || normalizedCode.toLowerCase().includes(normalizedName.toLowerCase())) {
    return normalizedCode;
  }

  return `${normalizedCode}.${normalizedName}`;
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
  page,
  totalPages,
  totalItems,
  pageSize,
  isFetching,
  isDeleting,
  currentUser,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onDelete,
}: QuotationManagerProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [qrTarget, setQrTarget] = useState<Quotation | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Quotation | null>(null);

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
        title="Báo phí"
        action={{
          label: 'Thêm báo phí',
          href: '/quotations/new',
          icon: <AddRoundedIcon />,
          disabled: !canCreateQuotation(currentUser),
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(280px,1fr)_176px]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm mã báo phí, lead, dịch vụ, ghi chú..."
            value={filters.keyword}
            onChange={(value) => updateFilters({ keyword: value })}
          />

          <CompactSelectField
            label="Trạng thái"
            value={filters.status}
            options={[
              { value: 'draft', label: 'Báo phí' },
              { value: 'won', label: 'Đã thanh toán' },
            ]}
            onChange={(value) => updateFilters({ status: value })}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'quotation',
              label: 'Báo phí',
              className: 'sticky left-0 z-20 w-48 bg-slate-100',
            },
            { key: 'customer', label: 'Khách hàng', className: 'w-[250px]' },
            { key: 'project', label: 'Dự án', className: 'w-[230px]' },
            { key: 'service', label: 'Dịch vụ', className: 'w-[230px]' },
            { key: 'total', label: 'Tổng báo', className: 'w-40 text-right' },
            { key: 'paid', label: 'Đã thu', className: 'w-40 text-right' },
            { key: 'status', label: 'Trạng thái', className: 'w-36' },
            { key: 'paymentStatus', label: 'Thanh toán', className: 'w-40' },
            { key: 'actions', className: 'w-36' },
          ]}
          isLoading={isFetching}
          isEmpty={quotations.length === 0}
          emptyText="Chưa có báo phí"
          minWidthClassName="min-w-[1580px]"
        >
          {quotations.map((quotation) => {
            const partyCode = quotation.customer?.customerCode || quotation.lead?.leadCode || '';
            const partyName =
              quotation.customer?.customerName || quotation.lead?.customerName || '-';
            const partyIdentity = getPartyIdentity(partyCode, partyName);
            const partyHref = quotation.customer
              ? `/customers/${quotation.customer.id}`
              : quotation.lead
                ? `/leads/${quotation.lead.id}`
                : '';
            const totalAmount = Number(quotation.totalAmount) || 0;
            const paidAmount = Number(quotation.paidAmount) || 0;

            return (
              <tr key={quotation.id} className="group hover:bg-slate-50/80">
                <td className="sticky left-0 z-10 bg-white px-3 py-4 group-hover:bg-slate-50">
                  <EntityTableLink
                    href={`/quotations/${quotation.id}`}
                    title={quotation.quotationCode || ''}
                  >
                    {quotation.quotationCode || '-'}
                  </EntityTableLink>
                </td>
                <td className="px-3 py-4">
                  {partyHref ? (
                    <Link
                      href={partyHref}
                      className="block truncate font-semibold text-slate-800 transition-colors hover:text-primary"
                      title={partyIdentity}
                    >
                      {partyIdentity}
                    </Link>
                  ) : (
                    <span
                      className="block truncate font-semibold text-slate-800"
                      title={partyIdentity}
                    >
                      {partyIdentity}
                    </span>
                  )}
                </td>
                <td className="px-3 py-4">
                  {quotation.project ? (
                    <EntityTableLink
                      href={`/projects/${quotation.project.id}`}
                      title={quotation.project.projectCode || ''}
                      tone="blue"
                    >
                      {quotation.project.projectCode || '-'}
                    </EntityTableLink>
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
                  <p className="truncate font-extrabold tabular-nums text-emerald-700">
                    {formatCurrency(paidAmount)}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${quotationStatusClass(quotation.status)}`}
                  >
                    {statusLabels[quotation.status || ''] || 'Báo phí'}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${paymentStatusClass(quotation.paymentStatus)}`}
                  >
                    {QUOTATION_PAYMENT_STATUS_LABELS[quotation.paymentStatus || ''] ||
                      quotation.paymentStatus ||
                      'Chưa thanh toán'}
                  </span>
                </td>
                <td className="py-4">
                  <div className="flex items-center justify-end gap-1 pr-3">
                    <IconButton
                      size="small"
                      title="Xem chi tiết báo phí"
                      aria-label={`Xem chi tiết báo phí ${quotation.quotationCode || quotation.id}`}
                      onClick={() => setPreviewTarget(quotation)}
                    >
                      <VisibilityRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Xem QR thanh toán"
                      aria-label={`Xem QR thanh toán báo phí ${quotation.quotationCode || quotation.id}`}
                      onClick={() => setQrTarget(quotation)}
                    >
                      <QrCode2RoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      component={Link}
                      href={`/quotations/${quotation.id}`}
                      size="small"
                      title="Chỉnh sửa báo phí"
                      aria-label={`Chỉnh sửa báo phí ${quotation.quotationCode || quotation.id}`}
                      disabled={!canEditQuotation(currentUser, quotation)}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Tác vụ"
                      aria-label={`Mở tác vụ báo phí ${quotation.quotationCode || quotation.id}`}
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

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          onClick={() => {
            setPreviewTarget(activeQuotation);
            closeActionMenu();
          }}
        >
          <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem chi tiết
        </MenuItem>
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
          disabled={!activeQuotation || !canEditQuotation(currentUser, activeQuotation)}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          className="text-rose-600"
          disabled={isDeleting || !activeQuotation || !canDeleteQuotation(currentUser, activeQuotation)}
          onClick={() => {
            setDeleteTarget(activeQuotation);
            closeActionMenu();
          }}
        >
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <QuotationPreviewDialog quotation={previewTarget} onClose={() => setPreviewTarget(null)} />

      <AppDetailDialog
        open={Boolean(qrTarget)}
        title="QR thanh toán"
        eyebrow={qrTarget?.quotationCode || undefined}
        subtitle={
          qrTarget?.customer?.customerName ||
          qrTarget?.lead?.customerName ||
          'Thông tin chuyển khoản'
        }
        maxWidth="md"
        onClose={() => setQrTarget(null)}
        actions={
          qrTarget ? (
            <DialogActionButton href={`/quotations/${qrTarget.id}`} startIcon={<EditRoundedIcon />}>
              Chỉnh sửa
            </DialogActionButton>
          ) : null
        }
      >
        <div className="p-4 sm:p-5">
          {qrTarget && getQuotationQrUrl(qrTarget) ? (
            <div className="grid gap-5 md:grid-cols-2 md:items-stretch">
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
                <img
                  src={getQuotationQrUrl(qrTarget)}
                  alt="Mã VietQR thanh toán báo phí"
                  className="aspect-square h-auto w-full max-w-[360px] rounded-xl bg-white object-contain"
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
                Báo phí này chưa có đủ thông tin tài khoản nhận tiền để tạo QR.
              </p>
            </div>
          )}
        </div>
      </AppDetailDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa báo phí?"
        description={`Bạn có chắc muốn xóa báo phí "${deleteTarget?.quotationCode || ''}"?`}
        confirmText="Xóa báo phí"
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
