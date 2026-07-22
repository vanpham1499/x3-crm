'use client';

import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { ServiceTableCell } from '@/components/table/service-table-cell';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { UserDateTimeCell } from '@/components/table/user-date-time-cell';
import { canCreateQuotation, canDeleteQuotation, canEditQuotation } from '@/lib/ownership';
import { getQuotationPaymentStatusLabel } from '@/lib/quotation-utils';
import type { Quotation, QuotationFilters } from '@/types/quotation';
import type { User } from '@/types/user';
import { QuickQuotationBuilderDialog } from './quick-quotation-builder-dialog';
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

const statusLabels: Record<string, string> = {
  draft: 'Báo phí',
  won: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
};

function quotationStatusClass(status?: string | null) {
  if (status === 'won') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'refunded') return 'bg-rose-50 text-rose-700 ring-rose-100';
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
  if (status === 'partially_refunded' || status === 'refunded') {
    return 'bg-rose-50 text-rose-700 ring-rose-100';
  }
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
  const [previewTarget, setPreviewTarget] = useState<Quotation | null>(null);
  const [quickBuilderOpen, setQuickBuilderOpen] = useState(false);

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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryActionButton
              tone="secondary"
              startIcon={<CalculateRoundedIcon />}
              disabled={!canCreateQuotation(currentUser)}
              onClick={() => setQuickBuilderOpen(true)}
            >
              Tạo báo phí nhanh
            </PrimaryActionButton>
            <PrimaryActionButton
              href="/quotations/new"
              startIcon={<AddRoundedIcon />}
              disabled={!canCreateQuotation(currentUser)}
            >
              Thêm báo phí
            </PrimaryActionButton>
          </div>
        }
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
              { value: 'refunded', label: 'Đã hoàn tiền' },
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
            { key: 'paid', label: 'Thực thu / hoàn', className: 'w-72 text-right' },
            { key: 'status', label: 'Trạng thái', className: 'w-36' },
            { key: 'paymentStatus', label: 'Thanh toán', className: 'w-40' },
            { key: 'created', label: 'Người tạo', className: 'w-[150px]' },
            { key: 'actions', className: 'w-36' },
          ]}
          isLoading={isFetching}
          isEmpty={quotations.length === 0}
          emptyText="Chưa có báo phí"
          minWidthClassName="min-w-[1730px]"
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
            const refundedAmount = Number(quotation.refundedAmount) || 0;
            const compensationAmount = Number(quotation.compensationAmount) || 0;

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
                  <ServiceTableCell code={quotation.serviceCode} name={quotation.serviceName} />
                </td>
                <td className="px-3 py-4 text-right font-extrabold tabular-nums text-slate-950">
                  {formatCurrency(totalAmount)}
                </td>
                <td className="px-3 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <span className="font-extrabold tabular-nums text-emerald-700">
                      {formatCurrency(paidAmount)}
                    </span>
                    {refundedAmount > 0 ? (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-rose-700 ring-1 ring-rose-100">
                        Hoàn {formatCurrency(refundedAmount)}
                      </span>
                    ) : null}
                    {compensationAmount > 0 ? (
                      <span className="rounded bg-fuchsia-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-fuchsia-700 ring-1 ring-fuchsia-100">
                        Bù {formatCurrency(compensationAmount)}
                      </span>
                    ) : null}
                  </div>
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
                    className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${
                      compensationAmount > 0
                        ? 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100'
                        : paymentStatusClass(quotation.paymentStatus)
                    }`}
                  >
                    {getQuotationPaymentStatusLabel(quotation)}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <UserDateTimeCell
                    userName={quotation.createdBy?.name}
                    dateTime={quotation.createdAt}
                  />
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
          disabled={
            isDeleting || !activeQuotation || !canDeleteQuotation(currentUser, activeQuotation)
          }
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

      {quickBuilderOpen ? (
        <QuickQuotationBuilderDialog open onClose={() => setQuickBuilderOpen(false)} />
      ) : null}

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
