'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MouseEvent } from 'react';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import type {
  ProjectCost,
  ProjectCostEntryType,
  ProjectCostFilters,
  ProjectCostStatus,
} from '@/types/project-cost';

type CostManagerProps = {
  costs: ProjectCost[];
  filters: ProjectCostFilters;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  isFetching: boolean;
  isReconciling: boolean;
  onFiltersChange: (filters: ProjectCostFilters) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onReconcile: (costId: number) => Promise<ProjectCost>;
};

type CostGroup = {
  key: string;
  costs: ProjectCost[];
};

const ENTRY_TYPE_LABELS: Record<ProjectCostEntryType, string> = {
  ad_spend: 'Nạp quảng cáo',
  partner_cost: 'Chi phí đối tác',
};

const STATUS_LABELS: Record<ProjectCostStatus, string> = {
  pending: 'Chờ xử lý',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const ACCEPTANCE_LABELS: Record<string, string> = {
  pending: 'Chờ nghiệm thu',
  accepted: 'Đã nghiệm thu',
  not_required: 'Không yêu cầu',
};

const INVOICE_LABELS: Record<string, string> = {
  pending: 'Chờ hóa đơn',
  received: 'Đã nhận hóa đơn',
  not_required: 'Không yêu cầu',
};

function formatCurrency(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} ₫`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function optionLabel(option?: ProjectCost['partnerOption'] | null) {
  return option?.label || option?.value || '-';
}

function groupCostsByProject(costs: ProjectCost[]): CostGroup[] {
  const groups = new Map<string, CostGroup>();

  costs.forEach((cost) => {
    const key = cost.projectId ? `project:${cost.projectId}` : `cost:${cost.id}`;
    const group = groups.get(key);

    if (group) {
      group.costs.push(cost);
    } else {
      groups.set(key, { key, costs: [cost] });
    }
  });

  return [...groups.values()];
}

function statusClass(status: ProjectCostStatus) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

function entryTypeClass(entryType: ProjectCostEntryType) {
  return entryType === 'ad_spend'
    ? 'bg-sky-50 text-sky-700 ring-sky-200'
    : 'bg-violet-50 text-violet-700 ring-violet-200';
}

function costSummary(cost: ProjectCost) {
  if (cost.entryType === 'ad_spend') {
    return [
      cost.cid ? `CID ${cost.cid}` : 'Chưa có CID',
      cost.adAccount,
      optionLabel(cost.bankAccountOption),
    ]
      .filter((value) => value && value !== '-')
      .join(' · ');
  }

  return [optionLabel(cost.partnerOption), ACCEPTANCE_LABELS[cost.acceptanceStatus || '']]
    .filter((value) => value && value !== '-')
    .join(' · ');
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[140px,minmax(0,1fr)] gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-bold text-slate-900">
        {value || '-'}
      </dd>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
}

function CostDetailDialog({ cost, onClose }: { cost: ProjectCost | null; onClose: () => void }) {
  if (!cost) return null;

  const isAdSpend = cost.entryType === 'ad_spend';
  const projectCode = cost.project?.projectCode || `Dự án #${cost.projectId}`;

  return (
    <AppDetailDialog
      open
      maxWidth="md"
      title={ENTRY_TYPE_LABELS[cost.entryType]}
      eyebrow={projectCode}
      subtitle={formatDate(cost.transactionDate)}
      onClose={onClose}
      actions={
        <DialogActionButton
          tone="primary"
          href={`/projects/${cost.projectId}`}
          startIcon={<WorkRoundedIcon />}
        >
          Mở dự án
        </DialogActionButton>
      }
    >
      <div className="space-y-4 bg-slate-50/60 p-4">
        <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tổng chi phí</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-rose-700">
              {formatCurrency(cost.totalAmount)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {isAdSpend ? 'Ngân sách nạp + VAT' : 'Trước VAT'}
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">
              {formatCurrency(cost.amountBeforeVat)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Trạng thái</p>
            <span
              className={`mt-1.5 inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(cost.status)}`}
            >
              {STATUS_LABELS[cost.status]}
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-4">
          <dl>
            <DetailRow label="Dự án" value={projectCode} />
            <DetailRow
              label="Đối soát"
              value={
                cost.reconciledAt
                  ? `Đã khớp · ${formatDateTime(cost.reconciledAt)}${cost.reconciledBy?.name ? ` · ${cost.reconciledBy.name}` : ''}`
                  : 'Chưa khớp'
              }
            />
            {isAdSpend ? (
              <>
                <DetailRow label="Mã CID" value={cost.cid} />
                <DetailRow label="Tài khoản quảng cáo" value={cost.adAccount} />
                <DetailRow
                  label="TK ngân hàng nạp QC"
                  value={optionLabel(cost.bankAccountOption)}
                />
                {cost.cidIsDead ? (
                  <DetailRow
                    label="CID ngừng hoạt động"
                    value={`Đã chạy ${formatCurrency(cost.cidSpentAmount)}`}
                  />
                ) : null}
              </>
            ) : (
              <>
                <DetailRow label="Đối tác" value={optionLabel(cost.partnerOption)} />
                <DetailRow
                  label="Nghiệm thu"
                  value={ACCEPTANCE_LABELS[cost.acceptanceStatus || ''] || '-'}
                />
                <DetailRow
                  label="Hóa đơn đầu vào"
                  value={INVOICE_LABELS[cost.inputInvoiceStatus || ''] || '-'}
                />
                <DetailRow label="VAT" value={`${Number(cost.vatRate) || 0}%`} />
                <DetailRow label="Tiền VAT" value={formatCurrency(cost.vatAmount)} />
                <DetailRow label="Giảm trừ" value={formatCurrency(cost.discountAmount)} />
              </>
            )}
            <DetailRow label="Ghi chú" value={cost.note} />
          </dl>
        </section>
      </div>
    </AppDetailDialog>
  );
}

export function CostManager({
  costs,
  filters,
  page,
  pageSize,
  totalPages,
  totalItems,
  isFetching,
  isReconciling,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onReconcile,
}: CostManagerProps) {
  const [viewTarget, setViewTarget] = useState<ProjectCost | null>(null);
  const [activeCost, setActiveCost] = useState<ProjectCost | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<ProjectCost | null>(null);
  const costGroups = groupCostsByProject(costs);

  const updateFilters = (nextFilters: Partial<ProjectCostFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, cost: ProjectCost) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveCost(cost);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveCost(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader title="Chi phí" />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_160px_152px_152px_150px_150px]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Dự án, CID, đối tác, ngân hàng, ghi chú..."
            value={filters.keyword}
            onChange={(keyword) => updateFilters({ keyword })}
          />
          <CompactSelectField
            label="Loại chi phí"
            value={filters.entry_type}
            options={[
              { value: 'ad_spend', label: 'Nạp quảng cáo' },
              { value: 'partner_cost', label: 'Chi phí đối tác' },
            ]}
            onChange={(entry_type) =>
              updateFilters({ entry_type: entry_type as ProjectCostFilters['entry_type'] })
            }
          />
          <CompactSelectField
            label="Trạng thái"
            value={filters.status}
            options={[
              { value: 'pending', label: 'Chờ xử lý' },
              { value: 'completed', label: 'Hoàn thành' },
              { value: 'cancelled', label: 'Đã hủy' },
            ]}
            onChange={(status) => updateFilters({ status: status as ProjectCostFilters['status'] })}
          />
          <CompactSelectField
            label="Đối soát"
            value={filters.reconciled_status}
            options={[
              { value: 'unmatched', label: 'Chưa khớp' },
              { value: 'matched', label: 'Đã khớp' },
            ]}
            onChange={(reconciled_status) =>
              updateFilters({
                reconciled_status: reconciled_status as ProjectCostFilters['reconciled_status'],
              })
            }
          />
          <FormDatePicker
            label="Từ ngày"
            value={filters.date_from}
            max={filters.date_to || undefined}
            onChange={(date_from) => updateFilters({ date_from })}
          />
          <FormDatePicker
            label="Đến ngày"
            value={filters.date_to}
            min={filters.date_from || undefined}
            onChange={(date_to) => updateFilters({ date_to })}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'date',
              label: 'Ngày nạp / chi',
              className: 'sticky left-0 z-20 w-36 bg-slate-100',
            },
            { key: 'type', label: 'Loại chi phí', className: 'w-44' },
            { key: 'amount', label: 'Số tiền', className: 'w-44 text-right' },
            { key: 'detail', label: 'Chi tiết', className: 'w-80' },
            { key: 'project', label: 'Dự án', className: 'w-64' },
            { key: 'status', label: 'Trạng thái', className: 'w-36' },
            { key: 'reconcile', label: 'Đối soát', className: 'w-28 text-center' },
            { key: 'actions', className: 'w-24' },
          ]}
          isLoading={isFetching}
          isEmpty={costs.length === 0}
          emptyText="Chưa có chi phí dự án"
          minWidthClassName="min-w-[1240px]"
        >
          {costGroups.flatMap((group) => {
            const firstCost = group.costs[0];
            const project = firstCost?.project;
            const rowSpan = group.costs.length;

            return group.costs.map((cost, rowIndex) => {
              const isFirstRow = rowIndex === 0;

              return (
                <tr
                  key={cost.id}
                  className={
                    isFirstRow
                      ? 'group border-t-2 border-slate-200 first:border-t-0 hover:bg-slate-50/80'
                      : 'group hover:bg-slate-50/80'
                  }
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-3.5 font-semibold tabular-nums text-slate-800 group-hover:bg-slate-50">
                    <span className="whitespace-nowrap">{formatDate(cost.transactionDate)}</span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${entryTypeClass(cost.entryType)}`}
                    >
                      {cost.entryType === 'ad_spend' ? (
                        <CampaignRoundedIcon className="!text-[16px]" />
                      ) : (
                        <HandshakeRoundedIcon className="!text-[16px]" />
                      )}
                      {ENTRY_TYPE_LABELS[cost.entryType]}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right font-extrabold tabular-nums text-rose-700">
                    <span className="whitespace-nowrap">{formatCurrency(cost.totalAmount)}</span>
                  </td>
                  <td className="px-3 py-3.5">
                    <p
                      className="truncate whitespace-nowrap text-sm font-semibold text-slate-700"
                      title={costSummary(cost)}
                    >
                      {costSummary(cost) || '-'}
                    </p>
                  </td>
                  {isFirstRow ? (
                    <td
                      rowSpan={rowSpan}
                      className="border-l border-slate-100 bg-slate-50/50 px-3 py-3.5 align-middle"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {project ? (
                          <EntityTableLink href={`/projects/${project.id}`} tone="blue">
                            {project.projectCode || `Dự án #${cost.projectId}`}
                          </EntityTableLink>
                        ) : (
                          <span className="font-semibold text-slate-500">
                            Dự án #{cost.projectId}
                          </span>
                        )}
                        {rowSpan > 1 ? (
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                            {rowSpan} khoản
                          </span>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                  <td className="px-3 py-3.5">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(cost.status)}`}
                    >
                      {STATUS_LABELS[cost.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    {cost.reconciledAt ? (
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                        title={`Đã khớp lúc ${formatDateTime(cost.reconciledAt)}`}
                      >
                        <CheckCircleRoundedIcon className="!text-[16px]" />
                        Đã khớp
                      </span>
                    ) : (
                      <IconButton
                        size="small"
                        disabled={isReconciling}
                        title="Xác nhận đã khớp"
                        aria-label={`Xác nhận khớp khoản chi ${cost.id}`}
                        className="!text-slate-400 transition-colors hover:!bg-slate-100 hover:!text-slate-700"
                        onClick={() => setReconcileTarget(cost)}
                      >
                        <CheckCircleOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    )}
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center justify-end gap-1 pr-3">
                      <IconButton
                        size="small"
                        title="Xem chi tiết"
                        aria-label={`Xem chi tiết chi phí ${cost.id}`}
                        onClick={() => setViewTarget(cost)}
                      >
                        <VisibilityRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Tác vụ"
                        aria-label={`Tác vụ chi phí ${cost.id}`}
                        onClick={(event) => openActionMenu(event, cost)}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            });
          })}
        </AppDataTable>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          rangeLabel="Hiển thị dự án"
          pageSizeLabel="Số dự án"
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          onClick={() => {
            setViewTarget(activeCost);
            closeActionMenu();
          }}
        >
          <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem chi tiết
        </MenuItem>
        {activeCost ? (
          <MenuItem
            component={Link}
            href={`/projects/${activeCost.projectId}`}
            onClick={closeActionMenu}
          >
            <OpenInNewRoundedIcon fontSize="small" className="mr-2 text-blue-600" />
            Mở dự án
          </MenuItem>
        ) : null}
      </Menu>

      <CostDetailDialog cost={viewTarget} onClose={() => setViewTarget(null)} />

      <ConfirmDialog
        open={Boolean(reconcileTarget)}
        title="Xác nhận khớp giao dịch?"
        description={
          reconcileTarget
            ? `Bạn có chắc đã khớp giao dịch ${formatCurrency(reconcileTarget.totalAmount)} chưa? Sau khi xác nhận, khoản chi này sẽ không thể chỉnh sửa hoặc xóa.`
            : ''
        }
        confirmText="Xác nhận đã khớp"
        loading={isReconciling}
        onClose={() => setReconcileTarget(null)}
        onConfirm={() => {
          if (!reconcileTarget) return;

          void onReconcile(reconcileTarget.id)
            .then(() => setReconcileTarget(null))
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
