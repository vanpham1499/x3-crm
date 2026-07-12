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
import { Checkbox, IconButton, InputAdornment, Menu, MenuItem, TextField } from '@mui/material';
import { PageHeader } from '@/components/shell/page-header';
import {
  CUSTOMER_ALL_STATUS,
  CUSTOMER_STATUS_TABS,
  CustomerPillTone,
  getCustomerLink,
  getCustomerPillToneClass,
  getCustomerSearchText,
  getCustomerStatusClass,
  getExternalUrl,
  getLinkLabel,
} from '@/lib/customer-utils';
import { formatDate } from '@/lib/utils';
import type { Customer } from '@/types/customer';

type CustomerListProps = {
  customers: Customer[];
  title?: string;
  breadcrumbLabel?: string;
  createLabel?: string;
  createHref?: string;
  editBasePath?: string;
  searchPlaceholder?: string;
  totalLabel?: string;
  primaryColumnLabel?: string;
  editTitle?: string;
};

function getCustomerRowId(customer: Customer) {
  return customer.leadCode || customer.customerCode;
}

function InfoPill({ value, tone }: { value: string; tone: CustomerPillTone }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${getCustomerPillToneClass(tone)}`}
      title={value || undefined}
    >
      <span className="truncate">{value || '-'}</span>
    </span>
  );
}

export function CustomerList({
  customers,
  title = 'Khách hàng',
  breadcrumbLabel = 'Khách hàng',
  createLabel = 'Thêm khách hàng',
  createHref = '/customers/new',
  editBasePath = '/customers',
  searchPlaceholder = 'Tìm khách hàng, số điện thoại, website, nguồn, dịch vụ...',
  totalLabel = 'khách hàng',
  primaryColumnLabel = 'Khách hàng',
  editTitle = 'Chỉnh sửa khách hàng',
}: CustomerListProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(CUSTOMER_ALL_STATUS);
  const [owner, setOwner] = useState(CUSTOMER_ALL_STATUS);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

  const owners = useMemo(() => {
    const values = customers.map((item) => item.owner).filter(Boolean);
    return [CUSTOMER_ALL_STATUS, ...Array.from(new Set(values))];
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return customers.filter((item) => {
      const matchesStatus = status === CUSTOMER_ALL_STATUS || item.status === status;
      const matchesOwner = owner === CUSTOMER_ALL_STATUS || item.owner === owner;
      const searchableText = getCustomerSearchText(item);

      return matchesStatus && matchesOwner && (!keyword || searchableText.includes(keyword));
    });
  }, [customers, owner, search, status]);

  const counts = useMemo(() => {
    return CUSTOMER_STATUS_TABS.reduce<Record<string, number>>((acc, item) => {
      acc[item] =
        item === CUSTOMER_ALL_STATUS
          ? customers.length
          : customers.filter((customer) => customer.status === item).length;
      return acc;
    }, {});
  }, [customers]);

  const visibleCustomerIds = useMemo(
    () => filteredCustomers.map(getCustomerRowId),
    [filteredCustomers],
  );
  const selectedVisibleCount = visibleCustomerIds.filter((id) =>
    selectedCustomerIds.includes(id),
  ).length;
  const hasSelectedRows = selectedCustomerIds.length > 0;
  const isAllVisibleSelected =
    visibleCustomerIds.length > 0 && selectedVisibleCount === visibleCustomerIds.length;
  const isSomeVisibleSelected = selectedVisibleCount > 0 && !isAllVisibleSelected;

  const toggleAllVisibleRows = (checked: boolean) => {
    if (checked) {
      setSelectedCustomerIds((current) => Array.from(new Set([...current, ...visibleCustomerIds])));
      return;
    }

    setSelectedCustomerIds((current) => current.filter((id) => !visibleCustomerIds.includes(id)));
  };

  const toggleCustomerRow = (customerId: string, checked: boolean) => {
    setSelectedCustomerIds((current) => {
      if (checked) return Array.from(new Set([...current, customerId]));
      return current.filter((id) => id !== customerId);
    });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, customer: Customer) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveCustomer(customer);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveCustomer(null);
  };

  const goToEditCustomer = () => {
    if (!activeCustomer) return;
    router.push(`${editBasePath}/${activeCustomer.leadCode}`);
    closeActionMenu();
  };

  const deleteActiveCustomer = () => {
    if (!activeCustomer) return;

    // TODO: Replace with API delete when backend endpoints are ready.
    setSelectedCustomerIds((current) =>
      current.filter((id) => id !== getCustomerRowId(activeCustomer)),
    );
    closeActionMenu();
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: breadcrumbLabel, href: editBasePath },
          { label: 'Danh sách' },
        ]}
        action={{ label: createLabel, href: createHref, icon: <AddRoundedIcon /> }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[520px]">
            <TextField
              select
              label="Trạng thái"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {CUSTOMER_STATUS_TABS.map((item) => (
                <MenuItem key={item} value={item}>
                  {item} ({counts[item] || 0})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Nhân sự"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            >
              {owners.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
          </div>
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
              <span>{selectedCustomerIds.length} selected</span>
            </div>
            <IconButton
              size="small"
              color="success"
              onClick={() => setSelectedCustomerIds([])}
              title="Xóa lựa chọn"
            >
              <DeleteRoundedIcon fontSize="small" />
            </IconButton>
          </div>
        )}

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
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
                <th className="sticky left-12 z-20 w-[340px] bg-slate-50 px-3 py-4">
                  {primaryColumnLabel}
                </th>
                <th className="w-28 px-3 py-4">Trạng thái</th>
                <th className="w-36 px-3 py-4">Nhân sự</th>
                <th className="w-36 px-3 py-4">Nguồn</th>
                <th className="w-40 px-3 py-4">Dịch vụ</th>
                <th className="w-32 px-3 py-4">Ngày phát sinh</th>
                <th className="px-3 py-4">Ghi chú</th>
                <th className="w-24 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((customer) => {
                const customerLink = getCustomerLink(customer);
                const customerId = getCustomerRowId(customer);
                const isSelected = selectedCustomerIds.includes(customerId);

                return (
                  <tr
                    key={`${customer.leadCode}-${customer.customerCode}`}
                    className={`group ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}
                  >
                    <td
                      className={`sticky left-0 z-10 px-5 py-3 ${
                        isSelected ? 'bg-emerald-50/60' : 'bg-white group-hover:bg-slate-50'
                      }`}
                    >
                      <Checkbox
                        color="success"
                        size="small"
                        checked={isSelected}
                        onChange={(event) => toggleCustomerRow(customerId, event.target.checked)}
                      />
                    </td>
                    <td
                      className={`sticky left-12 z-10 px-3 py-3 ${
                        isSelected ? 'bg-emerald-50/60' : 'bg-white group-hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-[316px] rounded-xl border border-slate-100 bg-white p-3 shadow-sm group-hover:border-slate-200">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate font-semibold text-slate-950">
                            {customer.customerCode || '-'}
                          </p>
                          {customer.phone && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-100">
                              <PhoneRoundedIcon className="!text-[14px]" />
                              {customer.phone}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex min-w-0 items-center gap-2">
                          {customer.industry && (
                            <span
                              className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600"
                              title={customer.industry}
                            >
                              {customer.industry}
                            </span>
                          )}

                          {customerLink ? (
                            <a
                              href={getExternalUrl(customerLink)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-w-0 items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                              title={customerLink}
                            >
                              <span className="truncate">{getLinkLabel(customerLink)}</span>
                              <OpenInNewRoundedIcon className="shrink-0 !text-[14px]" />
                            </a>
                          ) : (
                            <span className="truncate text-xs text-slate-400">
                              Chưa có website/link kế hoạch
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ${getCustomerStatusClass(customer.status)}`}
                      >
                        {customer.status || 'Trống'}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <InfoPill value={customer.owner} tone="blue" />
                    </td>
                    <td className="px-3 py-4">
                      <InfoPill value={customer.source} tone="violet" />
                    </td>
                    <td className="px-3 py-4">
                      <InfoPill value={customer.service} tone="slate" />
                    </td>
                    <td className="px-3 py-4 text-slate-700">{formatDate(customer.createdAt)}</td>
                    <td className="px-3 py-4">
                      <p
                        className="line-clamp-2 max-w-[420px] text-slate-500"
                        title={customer.note}
                      >
                        {customer.note || '-'}
                      </p>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center justify-end gap-1 pr-3">
                        <IconButton
                          component={Link}
                          href={`${editBasePath}/${customer.leadCode}`}
                          size="small"
                          className="text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title={editTitle}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          className="text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Tác vụ"
                          onClick={(event) => openActionMenu(event, customer)}
                        >
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
          <MenuItem onClick={goToEditCustomer}>
            <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Chỉnh sửa
          </MenuItem>
          <MenuItem onClick={deleteActiveCustomer} className="text-rose-600">
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hiển thị <strong className="text-slate-950">{filteredCustomers.length}</strong> /{' '}
            {customers.length} {totalLabel}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-lg px-3 py-2 font-semibold text-slate-400">
              Trước
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white"
            >
              1
            </button>
            <button type="button" className="rounded-lg px-3 py-2 font-semibold text-slate-400">
              Sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
