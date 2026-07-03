'use client';

import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Button,
  Checkbox,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  TextField,
} from '@mui/material';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { getLeadStatusClass, getUniqueLeadStatuses } from '@/lib/lead-utils';
import { getOptionColor } from '@/lib/option-utils';
import { formatDate } from '@/lib/utils';
import type { Lead, LeadFilters } from '@/types/lead';
import type { AppOption } from '@/types/option';
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
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
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
  const visibleLeadIds = useMemo(() => leads.map((lead) => lead.id), [leads]);
  const selectedVisibleCount = visibleLeadIds.filter((id) => selectedLeadIds.includes(id)).length;
  const isAllVisibleSelected =
    visibleLeadIds.length > 0 && selectedVisibleCount === visibleLeadIds.length;
  const isSomeVisibleSelected = selectedVisibleCount > 0 && !isAllVisibleSelected;
  const hasSelectedRows = selectedLeadIds.length > 0;

  const updateFilters = (nextFilters: Partial<LeadFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
    setSelectedLeadIds([]);
  };

  const toggleAllVisibleRows = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds((current) => Array.from(new Set([...current, ...visibleLeadIds])));
      return;
    }

    setSelectedLeadIds((current) => current.filter((id) => !visibleLeadIds.includes(id)));
  };

  const toggleLeadRow = (leadId: string, checked: boolean) => {
    setSelectedLeadIds((current) => {
      if (checked) return Array.from(new Set([...current, leadId]));
      return current.filter((id) => id !== leadId);
    });
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

  const deleteActiveLead = () => {
    if (activeLead) setDeleteTarget(activeLead);
    closeActionMenu();
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Lead</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Lead</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Danh sách</span>
          </div>
        </div>

        <Button
          component={Link}
          href="/leads/new"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Thêm lead
        </Button>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[minmax(280px,1fr)_repeat(4,190px)]">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm lead, số điện thoại, website, ngành..."
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
            value={filters.status_option_id || filters.status_id}
            onChange={(event) =>
              updateFilters({ status_option_id: event.target.value, status_id: '' })
            }
          >
            <MenuItem value="">Tất cả</MenuItem>
            {statusOptions.map((status) => (
              <MenuItem key={status.id} value={status.id}>
                {status.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Nhân sự"
            value={filters.assigned_user_id}
            onChange={(event) => updateFilters({ assigned_user_id: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {users.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.name || user.email || user.code}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Nguồn"
            value={filters.source_option_id || filters.source_id}
            onChange={(event) =>
              updateFilters({ source_option_id: event.target.value, source_id: '' })
            }
          >
            <MenuItem value="">Tất cả</MenuItem>
            {sources.map((source) => (
              <MenuItem key={source.id} value={source.id}>
                {source.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Dịch vụ"
            value={filters.interested_service_option_id || filters.interested_service_id}
            onChange={(event) =>
              updateFilters({
                interested_service_option_id: event.target.value,
                interested_service_id: '',
              })
            }
          >
            <MenuItem value="">Tất cả</MenuItem>
            {services.map((service) => (
              <MenuItem key={service.id} value={service.id}>
                {service.label}
              </MenuItem>
            ))}
          </TextField>
        </div>

        {hasSelectedRows && (
          <div className="flex h-14 items-center justify-between bg-emerald-100 px-5 text-sm font-bold text-emerald-700">
            <div className="flex items-center gap-4">
              <Checkbox
                color="success"
                size="small"
                checked
                onChange={(event) => toggleAllVisibleRows(event.target.checked)}
              />
              <span>{selectedLeadIds.length} selected</span>
            </div>
            <IconButton
              size="small"
              color="success"
              onClick={() => setSelectedLeadIds([])}
              title="Xóa lựa chọn"
            >
              <DeleteRoundedIcon fontSize="small" />
            </IconButton>
          </div>
        )}

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[1280px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="sticky left-0 z-20 w-12 bg-slate-50 px-5 py-4">
                  <Checkbox
                    color="success"
                    size="small"
                    checked={isAllVisibleSelected}
                    indeterminate={isSomeVisibleSelected}
                    onChange={(event) => toggleAllVisibleRows(event.target.checked)}
                  />
                </th>
                <th className="sticky left-12 z-20 w-[360px] bg-slate-50 px-3 py-4">Lead</th>
                <th className="w-32 px-3 py-4">Trạng thái</th>
                <th className="w-40 px-3 py-4">Nhân sự</th>
                <th className="w-36 px-3 py-4">Nguồn</th>
                <th className="w-44 px-3 py-4">Dịch vụ</th>
                <th className="w-32 px-3 py-4">Ngày phát sinh</th>
                <th className="px-3 py-4">Ghi chú</th>
                <th className="w-24 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-sm font-semibold text-slate-500"
                  >
                    Không có dữ liệu lead
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id);
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

                  return (
                    <tr
                      key={lead.id}
                      className={`group ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}
                    >
                      <td
                        className={`sticky left-0 z-10 px-5 py-3 ${isSelected ? 'bg-emerald-50/60' : 'bg-white group-hover:bg-slate-50'}`}
                      >
                        <Checkbox
                          color="success"
                          size="small"
                          checked={isSelected}
                          onChange={(event) => toggleLeadRow(lead.id, event.target.checked)}
                        />
                      </td>
                      <td
                        className={`sticky left-12 z-10 px-3 py-3 ${isSelected ? 'bg-emerald-50/60' : 'bg-white group-hover:bg-slate-50'}`}
                      >
                        <div className="w-[336px] rounded-xl border border-slate-100 bg-white p-3 shadow-sm group-hover:border-slate-200">
                          <p
                            className="truncate font-semibold text-slate-950"
                            title={lead.customerName}
                          >
                            {lead.customerName}
                          </p>

                          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                            {lead.phone && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-100">
                                <PhoneRoundedIcon className="!text-[14px]" />
                                {lead.phone}
                              </span>
                            )}
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
                      <td className="px-3 py-4 text-slate-700">
                        {formatDate(lead.occurredDate || '')}
                      </td>
                      <td className="px-3 py-4">
                        <p
                          className="line-clamp-2 max-w-[420px] text-slate-500"
                          title={lead.note || ''}
                        >
                          {lead.note || '-'}
                        </p>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-end gap-1 pr-3">
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
                })
              )}
            </tbody>
          </table>
        </div>

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
          <MenuItem onClick={editActiveLead}>
            <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Chỉnh sửa
          </MenuItem>
          <MenuItem onClick={deleteActiveLead} className="text-rose-600">
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hiển thị <strong className="text-slate-950">{leads.length}</strong> lead
          </span>
        </div>
      </section>

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
