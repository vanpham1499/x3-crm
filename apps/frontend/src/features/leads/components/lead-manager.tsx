'use client';

import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { Button, IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { getLeadStatusClass, getUniqueLeadStatuses } from '@/lib/lead-utils';
import { getOptionColor } from '@/lib/option-utils';
import { formatDate, formatDateTime } from '@/lib/utils';
import api from '@/services/api/client';
import type { Lead, LeadFilters, LeadTimelineEntry } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { Quotation } from '@/types/quotation';
import type { User } from '@/types/user';

type LeadManagerProps = {
  leads: Lead[];
  users: User[];
  statuses: AppOption[];
  sources: AppOption[];
  services: AppOption[];
  filters: LeadFilters;
  isFetching: boolean;
  isDeleting: boolean;
  onFiltersChange: (filters: LeadFilters) => void;
  onDelete: (lead: Lead) => void;
};

function externalUrl(value?: string | null) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function shortLink(value?: string | null) {
  if (!value) return '';

  return value
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0];
}

function getLeadIdentity(lead: Lead) {
  const leadCode = lead.leadCode?.trim();
  const customerName = lead.customerName.trim();

  if (!leadCode) return customerName;
  if (leadCode.toLowerCase().includes(customerName.toLowerCase())) return leadCode;

  return `${leadCode}.${customerName}`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(value)) return null;

  const numberValue = Number.parseInt(value, 16);

  return {
    r: (numberValue >> 16) & 255,
    g: (numberValue >> 8) & 255,
    b: numberValue & 255,
  };
}

function optionChipStyle(option?: AppOption | null) {
  if (!option) return undefined;

  const color = getOptionColor(option);
  const rgb = hexToRgb(color);

  if (!rgb) return undefined;

  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
    borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`,
    color,
  };
}

function OptionChip({
  label,
  option,
  className = '',
  fallbackClassName,
}: {
  label: string;
  option?: AppOption | null;
  className?: string;
  fallbackClassName: string;
}) {
  const style = optionChipStyle(option);

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2 py-1 text-xs font-bold ${className} ${style ? '' : fallbackClassName}`}
      style={style}
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function stringValue(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  return String(value);
}

function getLeadStatusColor(lead: Lead) {
  if (lead.statusOption) return getOptionColor(lead.statusOption);
  return '#2563eb';
}

function getEntryData(entry: LeadTimelineEntry) {
  if (entry.contentData) return entry.contentData;

  if (!entry.content) return null;

  try {
    const parsed = JSON.parse(entry.content);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getEntryStatusOption(entry: LeadTimelineEntry, statuses: AppOption[]) {
  if (entry.statusOption) return entry.statusOption;

  const status = getEntryData(entry)?.status;
  if (!status) return null;

  const matchedOption = statuses.find(
    (option) =>
      (status.id && option.id === status.id) ||
      (status.key && option.key === status.key) ||
      (status.label && option.label === status.label),
  );

  if (matchedOption) return matchedOption;

  if (status.id || status.label || status.color || status.meta) {
    return {
      id: status.id || status.key || status.label || 'timeline-status',
      group: 'lead_status',
      key: status.key || undefined,
      label: status.label || status.key || 'Trạng thái',
      meta: status.meta || (status.color ? { color: status.color } : {}),
      isActive: true,
    };
  }

  return null;
}

function getEntryColor(entry: LeadTimelineEntry, lead: Lead, statuses: AppOption[]) {
  const entryStatusOption = getEntryStatusOption(entry, statuses);

  if (entryStatusOption) return getOptionColor(entryStatusOption);
  if (entry.statusOption) return getOptionColor(entry.statusOption);
  return getLeadStatusColor(lead);
}

function getTimelineEntries(lead: Lead) {
  const entries =
    lead.timelines ||
    lead.timeline ||
    lead.histories ||
    lead.history ||
    lead.activities ||
    lead.activityLogs ||
    lead.logs ||
    lead.audits ||
    [];

  if (entries.length > 0) {
    return entries;
  }

  const fallbackEntries: LeadTimelineEntry[] = [];

  if (lead.updatedAt) {
    fallbackEntries.push({
      id: `${lead.id}-updated`,
      title: 'Cập nhật lead',
      description:
        lead.note ||
        (lead.statusOption?.label
          ? `Trạng thái hiện tại: ${lead.statusOption.label}`
          : 'Thông tin lead đã được cập nhật'),
      occurredAt: lead.updatedAt,
      actor: lead.assignedUser,
      statusOption: lead.statusOption,
    });
  }

  if (lead.createdAt) {
    fallbackEntries.push({
      id: `${lead.id}-created`,
      title: 'Tạo lead',
      description: lead.assignedUser?.name ? `Người phụ trách: ${lead.assignedUser.name}` : '',
      occurredAt: lead.createdAt,
      actor: lead.assignedUser,
      statusOption: lead.statusOption,
    });
  }

  return fallbackEntries;
}

function getEntryTime(entry: LeadTimelineEntry) {
  return entry.occurredAt || entry.createdAt || entry.updatedAt || entry.time || '';
}

function getEntryActor(entry: LeadTimelineEntry) {
  return (
    entry.actor ||
    getEntryData(entry)?.actor ||
    entry.user ||
    entry.createdBy ||
    entry.updatedBy ||
    null
  );
}

function getEntryTitle(entry: LeadTimelineEntry) {
  const data = getEntryData(entry);

  return data?.title || entry.title || data?.action || entry.action || entry.type || 'Cập nhật';
}

function getEntryDescription(entry: LeadTimelineEntry) {
  const data = getEntryData(entry);

  if (entry.description || entry.note || data?.note) {
    return entry.description || entry.note || data?.note || '';
  }

  return data ? '' : entry.content || '';
}

function getEntryChanges(entry: LeadTimelineEntry) {
  return entry.changes || getEntryData(entry)?.changes || [];
}

function getQuotationStatusLabel(status?: string | null) {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === 'draft') return 'Nháp';
  if (normalizedStatus === 'sent') return 'Đã gửi';
  if (normalizedStatus === 'won') return 'Đã chốt';
  if (normalizedStatus === 'lost') return 'Không chốt';

  return status || '-';
}

function getQuotationStatusClass(status?: string | null) {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === 'won') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (normalizedStatus === 'sent') return 'bg-sky-50 text-sky-700 ring-sky-100';
  if (normalizedStatus === 'lost') return 'bg-rose-50 text-rose-700 ring-rose-100';

  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function LeadDetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 text-sm">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 font-semibold text-slate-800">{stringValue(value)}</dd>
    </div>
  );
}

function LeadViewDialog({
  lead,
  statuses,
  tab,
  isLoading,
  onTabChange,
  onClose,
}: {
  lead: Lead | null;
  statuses: AppOption[];
  tab: number;
  isLoading: boolean;
  onTabChange: (tab: number) => void;
  onClose: () => void;
}) {
  const { data: quotations = [], isFetching: isFetchingQuotations } = useQuery<Quotation[]>({
    queryKey: ['quotations', 'by-lead', lead?.id],
    queryFn: () =>
      api
        .get<Quotation[]>('/quotations', { params: { lead_id: lead?.id } })
        .then((response) => response.data),
    enabled: Boolean(lead?.id),
  });

  if (!lead) return null;

  const serviceOptions = lead.interestedServiceOptions?.length
    ? lead.interestedServiceOptions
    : lead.interestedServiceOption
      ? [lead.interestedServiceOption]
      : [];
  const timelineEntries = getTimelineEntries(lead);
  const link = lead.website || lead.planLink;
  const industryName = lead.industryOption?.label || lead.industry;
  const sourceName = lead.sourceOption?.label || lead.source?.name;
  const serviceNames = serviceOptions.length
    ? serviceOptions.map((service) => service.label).join(', ')
    : lead.interestedService?.name || lead.interestedServiceText;

  return (
    <AppDetailDialog
      open
      title={lead.customerName}
      eyebrow={lead.leadCode || `Lead #${lead.id}`}
      loading={isLoading || isFetchingQuotations}
      onClose={onClose}
      actions={
        <>
          {lead.convertedCustomerId ? (
            <DialogActionButton
              href={`/customers/${lead.convertedCustomerId}`}
              tone="primary"
              endIcon={<OpenInNewRoundedIcon />}
            >
              Mở khách hàng
            </DialogActionButton>
          ) : (
            <>
              <DialogActionButton
                href={`/quotations/new?leadId=${lead.id}`}
                startIcon={<RequestQuoteRoundedIcon />}
              >
                Tạo báo giá
              </DialogActionButton>
              <DialogActionButton
                href={`/customers/new?leadId=${lead.id}`}
                tone="primary"
                startIcon={<PersonAddAlt1RoundedIcon />}
              >
                Tạo khách hàng mới
              </DialogActionButton>
            </>
          )}
          <DialogActionButton href={`/leads/${lead.id}`} startIcon={<EditRoundedIcon />}>
            Chỉnh sửa lead
          </DialogActionButton>
        </>
      }
    >
      <IconTabs
        value={tab}
        onChange={onTabChange}
        ariaLabel="Nội dung chi tiết lead"
        items={[
          {
            label: 'Thông tin',
            icon: <InfoRoundedIcon className="!text-[18px]" />,
          },
          {
            label: 'Lịch sử chăm sóc',
            icon: <HistoryRoundedIcon className="!text-[18px]" />,
          },
          {
            label: 'Lịch sử báo giá',
            icon: <RequestQuoteRoundedIcon className="!text-[18px]" />,
          },
        ]}
      />

      <div className="bg-slate-50/60">
        {tab === 0 && (
          <div role="tabpanel" aria-label="Thông tin lead" className="p-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-950">Thông tin lead</h3>
              <dl className="grid gap-3 lg:grid-cols-2">
                <LeadDetailRow label="Khách hàng" value={lead.customerName} />
                <LeadDetailRow label="SĐT" value={lead.phone} />
                <LeadDetailRow label="Nguồn" value={sourceName} />
                <LeadDetailRow label="Dịch vụ quan tâm" value={serviceNames} />
                <LeadDetailRow label="Người phụ trách" value={lead.assignedUser?.name} />
                <LeadDetailRow label="Website" value={link} />
                <LeadDetailRow label="Dự án" value={lead.planLink} />
                <LeadDetailRow label="Ngành" value={industryName} />
                <LeadDetailRow label="Ngày phát sinh" value={formatDate(lead.occurredDate || '')} />
                <LeadDetailRow label="Ngày chốt" value={formatDate(lead.closedDate || '')} />
                <LeadDetailRow label="Zalo" value={lead.zaloGroup} />
              </dl>

              <div className="mt-4 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-100">
                <p className="text-xs font-bold uppercase text-amber-700">Ghi chú</p>
                <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-800">
                  {stringValue(lead.note)}
                </p>
              </div>
            </section>
          </div>
        )}

        {tab === 1 && (
          <div role="tabpanel" aria-label="Lịch sử chăm sóc" className="p-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-950">
                <HistoryRoundedIcon className="!text-[18px] text-slate-500" />
                Lịch sử chăm sóc
              </h3>
              <LeadTimelineList entries={timelineEntries} lead={lead} statuses={statuses} />
            </section>
          </div>
        )}

        {tab === 2 && (
          <div role="tabpanel" aria-label="Lịch sử báo giá" className="p-4">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-950">
                  Lịch sử báo giá ({quotations.length})
                </h3>
                {!lead.convertedCustomerId && (
                  <DialogActionButton
                    href={`/quotations/new?leadId=${lead.id}`}
                    startIcon={<RequestQuoteRoundedIcon />}
                  >
                    Tạo báo giá
                  </DialogActionButton>
                )}
              </div>

              {quotations.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-500">Lead chưa có báo giá nào.</p>
                </div>
              ) : (
                <div className="text-sm">
                  <div className="hidden grid-cols-[minmax(180px,1fr)_150px_110px_112px] gap-3 bg-slate-50 px-4 py-2 text-xs font-bold uppercase text-slate-500 md:grid">
                    <span>Báo giá</span>
                    <span>Tổng tiền</span>
                    <span>Trạng thái</span>
                    <span />
                  </div>
                  <div className="divide-y divide-slate-100">
                    {quotations.map((quotation) => (
                      <div
                        key={quotation.id}
                        className="grid gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 md:grid-cols-[minmax(180px,1fr)_150px_110px_112px] md:items-center"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/quotations/${quotation.id}`}
                            className="text-sm font-semibold text-slate-950 hover:text-emerald-700 hover:underline"
                          >
                            {quotation.quotationCode || `#${quotation.id}`}
                          </Link>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            {quotation.createdAt
                              ? formatDate(quotation.createdAt)
                              : 'Chưa có ngày tạo'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold tabular-nums text-slate-800">
                            {new Intl.NumberFormat('vi-VN').format(
                              Math.round(Number(quotation.totalAmount) || 0),
                            )}{' '}
                            đ
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-md px-2 py-1 text-xs font-bold ring-1 ${getQuotationStatusClass(quotation.status)}`}
                        >
                          {getQuotationStatusLabel(quotation.status)}
                        </span>
                        {!quotation.projectId && lead.convertedCustomerId ? (
                          <DialogActionButton
                            href={`/projects/new?customerId=${lead.convertedCustomerId}&quotationId=${quotation.id}`}
                          >
                            Tạo dự án
                          </DialogActionButton>
                        ) : (
                          <DialogActionButton href={`/quotations/${quotation.id}`}>
                            Mở báo giá
                          </DialogActionButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppDetailDialog>
  );
}

function LeadTimelineList({
  entries,
  lead,
  statuses,
}: {
  entries: LeadTimelineEntry[];
  lead: Lead;
  statuses: AppOption[];
}) {
  if (entries.length === 0) {
    return <p className="text-sm font-medium text-slate-500">Chưa có lịch sử chăm sóc.</p>;
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, index) => {
        const color = getEntryColor(entry, lead, statuses);
        const actor = getEntryActor(entry);
        const time = getEntryTime(entry);
        const title = getEntryTitle(entry);
        const description = getEntryDescription(entry);
        const changes = getEntryChanges(entry);

        return (
          <li
            key={entry.id || `${time}-${index}`}
            className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
          >
            <div className="relative flex justify-center">
              {index < entries.length - 1 && (
                <span className="absolute top-5 h-full w-px bg-slate-200" />
              )}
              <span
                className="relative mt-1 h-3 w-3 rounded-full ring-4 ring-white"
                style={{ backgroundColor: color }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{title}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {formatDateTime(time)}
                {actor?.name ? ` - ${actor.name}` : ''}
              </p>
              {description && (
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                  {description}
                </p>
              )}
              {changes.length > 0 && (
                <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3">
                  {changes.map((change, changeIndex) => (
                    <p
                      key={`${change.field || change.label}-${changeIndex}`}
                      className="text-xs text-slate-600"
                    >
                      <span className="font-bold text-slate-800">
                        {change.label || change.field || 'Trường dữ liệu'}:
                      </span>{' '}
                      {stringValue(change.oldValue ?? change.old ?? change.from)} →{' '}
                      {stringValue(change.newValue ?? change.new ?? change.to)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function LeadManager({
  leads,
  users,
  statuses,
  sources,
  services,
  filters,
  isFetching,
  isDeleting,
  onFiltersChange,
  onDelete,
}: LeadManagerProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [viewTarget, setViewTarget] = useState<Lead | null>(null);
  const [viewTab, setViewTab] = useState(0);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(leads, {
    resetKey: filters,
  });
  const viewLeadId = viewTarget?.id || '';
  const { data: viewLeadDetail, isFetching: isFetchingViewLead } = useQuery<Lead>({
    queryKey: ['leads', viewLeadId, 'quick-view'],
    queryFn: () => api.get(`/leads/${viewLeadId}`).then((response) => response.data),
    enabled: Boolean(viewLeadId),
  });
  const statusOptions = useMemo(
    () =>
      statuses.length
        ? statuses.map((status) => ({
            id: status.id,
            name: status.label,
            sortOrder: status.sortOrder || 0,
          }))
        : getUniqueLeadStatuses(leads),
    [leads, statuses],
  );
  const updateFilters = (nextFilters: Partial<LeadFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, lead: Lead) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveLead(lead);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveLead(null);
  };

  const editActiveLead = () => {
    if (activeLead) router.push(`/leads/${activeLead.id}`);
    closeActionMenu();
  };

  const viewLead = (lead: Lead, tab = 0) => {
    setViewTarget(lead);
    setViewTab(tab);
  };

  const viewActiveLead = () => {
    if (activeLead) viewLead(activeLead);
    closeActionMenu();
  };

  const deleteActiveLead = () => {
    if (activeLead) setDeleteTarget(activeLead);
    closeActionMenu();
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Lead"
        action={{
          label: 'Thêm lead',
          href: '/leads/new',
          icon: <AddRoundedIcon />,
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3  border-slate-200 p-4 lg:grid-cols-[minmax(260px,1fr)_repeat(4,176px)]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm lead, số điện thoại, website, ngành..."
            value={filters.keyword}
            onChange={(value) => updateFilters({ keyword: value })}
          />

          <CompactSelectField
            label="Trạng thái"
            value={filters.status_option_id || filters.status_id}
            options={statusOptions.map((status) => ({
              value: String(status.id),
              label: status.name,
            }))}
            onChange={(value) => updateFilters({ status_option_id: value, status_id: '' })}
          />

          <CompactSelectField
            label="Nhân sự"
            value={filters.assigned_user_id}
            options={users.map((user) => ({
              value: String(user.id),
              label: user.name || user.email || user.code || '-',
            }))}
            onChange={(value) => updateFilters({ assigned_user_id: value })}
          />

          <CompactSelectField
            label="Nguồn"
            value={filters.source_option_id || filters.source_id}
            options={sources.map((source) => ({
              value: String(source.id),
              label: source.label,
            }))}
            onChange={(value) => updateFilters({ source_option_id: value, source_id: '' })}
          />

          <CompactSelectField
            label="Dịch vụ"
            value={filters.interested_service_option_id || filters.interested_service_id}
            options={services.map((service) => ({
              value: String(service.id),
              label: service.label,
            }))}
            onChange={(value) =>
              updateFilters({
                interested_service_option_id: value,
                interested_service_id: '',
              })
            }
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'lead',
              label: 'Lead',
              className: 'sticky left-0 z-20 w-[360px] bg-slate-100',
            },
            { key: 'status', label: 'Trạng thái', className: 'w-32' },
            { key: 'assignee', label: 'Nhân sự', className: 'w-40' },
            { key: 'source', label: 'Nguồn', className: 'w-36' },
            { key: 'service', label: 'Dịch vụ', className: 'w-44' },
            { key: 'occurredDate', label: 'Ngày phát sinh', className: 'w-32' },
            { key: 'note', label: 'Ghi chú' },
            { key: 'actions', className: 'w-36' },
          ]}
          isLoading={isFetching}
          isEmpty={pageItems.length === 0}
          emptyText="Không có dữ liệu lead"
          minWidthClassName="min-w-[1240px]"
        >
          {pageItems.map((lead) => {
            const link = lead.website || lead.planLink;
            const serviceOptions = lead.interestedServiceOptions?.length
              ? lead.interestedServiceOptions
              : lead.interestedServiceOption
                ? [lead.interestedServiceOption]
                : [];
            const fallbackServiceName =
              lead.interestedService?.name || lead.interestedServiceText || '';
            const status = lead.statusOption
              ? {
                  id: lead.statusOption.id,
                  name: lead.statusOption.label,
                  sortOrder: lead.statusOption.sortOrder || 0,
                }
              : lead.status;
            const sourceName = lead.sourceOption?.label || lead.source?.name || '-';
            const industryName = lead.industryOption?.label || lead.industry;
            const leadIdentity = getLeadIdentity(lead);

            return (
              <tr key={lead.id} className="group hover:bg-slate-50/80">
                <td className="sticky left-0 z-10 bg-white px-3 py-3 group-hover:bg-slate-50">
                  <div className="w-[336px] rounded-xl border border-slate-100 bg-white p-3 shadow-sm group-hover:border-slate-200">
                    <div className="flex min-w-0 items-center gap-2">
                      <p
                        className="min-w-0 flex-1 truncate font-semibold text-slate-950"
                        title={leadIdentity}
                      >
                        {leadIdentity}
                      </p>
                      {lead.phone && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-100">
                          <PhoneRoundedIcon className="!text-[14px]" />
                          {lead.phone}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                      {industryName && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                          {industryName}
                        </span>
                      )}
                      {link && (
                        <a
                          href={externalUrl(link)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-w-0 items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                          title={link}
                        >
                          <span className="truncate">{shortLink(link)}</span>
                          <OpenInNewRoundedIcon className="shrink-0 !text-[14px]" />
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4">
                  {lead.statusOption ? (
                    <OptionChip
                      label={lead.statusOption.label}
                      option={lead.statusOption}
                      className="max-w-[120px]"
                      fallbackClassName="border-amber-100 bg-amber-50 text-amber-700"
                    />
                  ) : (
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${getLeadStatusClass(status)}`}
                    >
                      {status?.name || 'Mới'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-4">
                  <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-100">
                    {lead.assignedUser?.name || '-'}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <OptionChip
                    label={sourceName}
                    option={lead.sourceOption}
                    className="max-w-[128px]"
                    fallbackClassName="border-violet-100 bg-violet-50 text-violet-700"
                  />
                </td>
                <td className="px-3 py-4">
                  <div className="flex max-w-[168px] flex-wrap gap-1.5">
                    {serviceOptions.length > 0 ? (
                      serviceOptions.map((service) => (
                        <OptionChip
                          key={service.id}
                          label={service.label}
                          option={service}
                          className="max-w-[160px]"
                          fallbackClassName="border-slate-200 bg-slate-100 text-slate-700"
                        />
                      ))
                    ) : (
                      <OptionChip
                        label={fallbackServiceName || '-'}
                        className="max-w-[160px]"
                        fallbackClassName="border-slate-200 bg-slate-100 text-slate-700"
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-4 text-slate-700">{formatDate(lead.occurredDate || '')}</td>
                <td className="px-3 py-4">
                  <p className="line-clamp-2 max-w-[420px] text-slate-500" title={lead.note || ''}>
                    {lead.note || '-'}
                  </p>
                </td>
                <td className="py-4">
                  <div className="flex items-center justify-end gap-1 pr-3">
                    <IconButton
                      size="small"
                      title="Xem chi tiết lead"
                      onClick={() => viewLead(lead)}
                    >
                      <VisibilityRoundedIcon fontSize="small" />
                    </IconButton>
                    {lead.convertedCustomerId ? (
                      <IconButton
                        component={Link}
                        href={`/customers/${lead.convertedCustomerId}`}
                        size="small"
                        title="Mở khách hàng"
                      >
                        <OpenInNewRoundedIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <IconButton
                        component={Link}
                        href={`/customers/new?leadId=${lead.id}`}
                        size="small"
                        title="Tạo khách hàng"
                      >
                        <PersonAddAlt1RoundedIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      component={Link}
                      href={`/leads/${lead.id}`}
                      size="small"
                      title="Chỉnh sửa lead"
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Tác vụ"
                      onClick={(event) => openActionMenu(event, lead)}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </AppDataTable>

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
          <MenuItem onClick={viewActiveLead}>
            <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Xem chi tiết
          </MenuItem>
          <MenuItem onClick={editActiveLead}>
            <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Chỉnh sửa
          </MenuItem>
          <MenuItem onClick={deleteActiveLead} className="text-rose-600">
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>

      <LeadViewDialog
        lead={viewLeadDetail || viewTarget}
        statuses={statuses}
        tab={viewTab}
        isLoading={isFetchingViewLead}
        onTabChange={setViewTab}
        onClose={() => setViewTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa lead?"
        description={`Bạn có chắc muốn xóa lead "${deleteTarget?.customerName || ''}"? Thao tác này sẽ đưa lead ra khỏi danh sách.`}
        confirmText="Xóa lead"
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
