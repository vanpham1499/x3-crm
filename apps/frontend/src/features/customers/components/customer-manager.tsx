'use client';

import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import {
  Checkbox,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  TextField,
} from '@mui/material';
import type { Customer, CustomerFilters } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

type CustomerManagerProps = {
  customers: Customer[];
  users: User[];
  customerTypes: AppOption[];
  sources: AppOption[];
  industries: AppOption[];
  filters: CustomerFilters;
  isFetching: boolean;
  isDeleting: boolean;
  onFiltersChange: (filters: CustomerFilters) => void;
  onDelete: (customer: Customer) => void;
};

function InfoPill({ value, className }: { value?: string | null; className: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${className}`}
      title={value || undefined}
    >
      <span className="truncate">{value || '-'}</span>
    </span>
  );
}

export function CustomerManager({
  customers,
  users,
  customerTypes,
  sources,
  industries,
  filters,
  isFetching,
  isDeleting,
  onFiltersChange,
  onDelete,
}: CustomerManagerProps) {
  const router = useRouter();
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

  const visibleCustomerIds = useMemo(() => customers.map((customer) => customer.id), [customers]);
  const selectedVisibleCount = visibleCustomerIds.filter((id) =>
    selectedCustomerIds.includes(id),
  ).length;
  const isAllVisibleSelected =
    visibleCustomerIds.length > 0 && selectedVisibleCount === visibleCustomerIds.length;
  const isSomeVisibleSelected = selectedVisibleCount > 0 && !isAllVisibleSelected;
  const hasSelectedRows = selectedCustomerIds.length > 0;

  const updateFilters = (nextFilters: Partial<CustomerFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
    setSelectedCustomerIds([]);
  };

  const toggleAllVisibleRows = (checked: boolean) => {
    if (checked) {
      setSelectedCustomerIds((current) => Array.from(new Set([...current, ...visibleCustomerIds])));
      return;
    }

    setSelectedCustomerIds((current) => current.filter((id) => !visibleCustomerIds.includes(id)));
  };

  const toggleCustomerRow = (customerId: number, checked: boolean) => {
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

  const editActiveCustomer = () => {
    if (activeCustomer) router.push(`/customers/${activeCustomer.id}`);
    closeActionMenu();
  };

  const createProjectForActiveCustomer = () => {
    if (activeCustomer) router.push(`/projects/new?customerId=${activeCustomer.id}`);
    closeActionMenu();
  };

  const deleteActiveCustomer = () => {
    if (activeCustomer) onDelete(activeCustomer);
    closeActionMenu();
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Khách hàng</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Khách hàng</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Danh sách</span>
          </div>
        </div>

      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[minmax(280px,1fr)_repeat(2,190px)]">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm mã, khách hàng, công ty, điện thoại, email..."
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
            label="Loại khách"
            value={filters.customer_type_option_id || ''}
            onChange={(event) =>
              updateFilters({ customer_type_option_id: Number(event.target.value) || 0 })
            }
          >
            <MenuItem value="">Tất cả</MenuItem>
            {customerTypes.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          {/* <TextField
            select
            label="Nguồn"
            value={filters.source_option_id}
            onChange={(event) => updateFilters({ source_option_id: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {sources.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.label}
              </MenuItem>
            ))}
          </TextField> */}

          {/* <TextField
            select
            label="Ngành"
            value={filters.industry_option_id}
            onChange={(event) => updateFilters({ industry_option_id: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {industries.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.label}
              </MenuItem>
            ))}
          </TextField> */}

          <TextField
            select
            label="Sales"
            value={filters.sales_user_id || ''}
            onChange={(event) =>
              updateFilters({ sales_user_id: Number(event.target.value) || 0 })
            }
          >
            <MenuItem value="">Tất cả</MenuItem>
            {users.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.name || user.email || user.code}
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

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[1180px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
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
                <th className="sticky left-12 z-20 w-36 bg-slate-50 px-3 py-4">Mã KH</th>
                <th className="w-[260px] px-3 py-4">Tên khách hàng</th>
                <th className="w-36 px-3 py-4">Loại KH</th>
                <th className="w-36 px-3 py-4">SĐT</th>
                <th className="w-56 px-3 py-4">Email</th>
                <th className="w-48 px-3 py-4">Người đại diện</th>
                <th className="w-44 px-3 py-4">Người phụ trách</th>
                <th className="w-32 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-sm font-semibold text-slate-500"
                  >
                    Không có dữ liệu khách hàng
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const isSelected = selectedCustomerIds.includes(customer.id);

                  return (
                    <tr
                      key={customer.id}
                      className={`group ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}
                    >
                      <td
                        className={`sticky left-0 z-10 px-5 py-3 ${isSelected ? 'bg-emerald-50/60' : 'bg-white group-hover:bg-slate-50'}`}
                      >
                        <Checkbox
                          color="success"
                          size="small"
                          checked={isSelected}
                          onChange={(event) => toggleCustomerRow(customer.id, event.target.checked)}
                        />
                      </td>
                      <td
                        className={`sticky left-12 z-10 px-3 py-4 font-bold text-slate-800 ${isSelected ? 'bg-emerald-50/60' : 'bg-white group-hover:bg-slate-50'}`}
                      >
                        <span className="block truncate" title={customer.customerCode}>
                          {customer.customerCode || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <p
                          className="truncate font-semibold text-slate-950"
                          title={customer.customerName}
                        >
                          {customer.customerName || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <InfoPill
                          value={customer.customerTypeOption?.label || customer.customerType}
                          className="bg-emerald-50 text-emerald-700 ring-emerald-100"
                        />
                      </td>
                      <td className="px-3 py-4 text-slate-700">
                        <span className="block truncate" title={customer.phone || ''}>
                          {customer.phone || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-700">
                        <span className="block truncate" title={customer.email || ''}>
                          {customer.email || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-700">
                        <span className="block truncate" title={customer.representativeName || ''}>
                          {customer.representativeName || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <InfoPill
                          value={customer.salesUser?.name}
                          className="bg-sky-50 text-sky-700 ring-sky-100"
                        />
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-end gap-1 pr-3">
                          <IconButton
                            component={Link}
                            href={`/customers/${customer.id}`}
                            size="small"
                            title="Chỉnh sửa khách hàng"
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            component={Link}
                            href={`/projects/new?customerId=${customer.id}`}
                            size="small"
                            title="Tạo dự án"
                          >
                            <WorkRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Tác vụ"
                            onClick={(event) => openActionMenu(event, customer)}
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
          <MenuItem onClick={editActiveCustomer}>
            <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Chỉnh sửa
          </MenuItem>
          <MenuItem onClick={createProjectForActiveCustomer}>
            <WorkRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Tạo dự án
          </MenuItem>
          <MenuItem onClick={deleteActiveCustomer} className="text-rose-600" disabled={isDeleting}>
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hiển thị <strong className="text-slate-950">{customers.length}</strong> khách hàng
          </span>
        </div>
      </section>
    </div>
  );
}
