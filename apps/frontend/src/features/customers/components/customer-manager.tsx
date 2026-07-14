'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import api from '@/services/api/client';
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
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isFetching: boolean;
  isDeleting: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
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

function getCustomerIdentity(customer: Customer) {
  const customerCode = customer.customerCode?.trim();
  const customerName = customer.customerName?.trim() || customer.companyName?.trim() || '';

  if (!customerCode) return customerName || '-';
  if (!customerName || customerCode.toLowerCase().includes(customerName.toLowerCase())) {
    return customerCode;
  }

  return `${customerCode}.${customerName}`;
}

function CustomerDetailRow({ label, value }: { label: string; value?: string | number | null }) {
  const displayValue = value === null || value === undefined || value === '' ? '-' : value;

  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 text-sm">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-slate-800">{displayValue}</dd>
    </div>
  );
}

function CustomerViewDialog({
  customer,
  tab,
  isLoading,
  onTabChange,
  onClose,
}: {
  customer: Customer | null;
  tab: number;
  isLoading: boolean;
  onTabChange: (tab: number) => void;
  onClose: () => void;
}) {
  if (!customer) return null;

  return (
    <AppDetailDialog
      open
      title={customer.customerName || customer.companyName || 'Khách hàng'}
      eyebrow={customer.customerCode || `Customer #${customer.id}`}
      loading={isLoading}
      onClose={onClose}
      actions={
        <>
          <DialogActionButton
            href={`/projects/new?customerId=${customer.id}`}
            startIcon={<WorkRoundedIcon />}
          >
            Tạo dự án
          </DialogActionButton>
          <DialogActionButton
            href={`/customers/${customer.id}`}
            tone="primary"
            startIcon={<EditRoundedIcon />}
          >
            Chỉnh sửa
          </DialogActionButton>
        </>
      }
    >
      <IconTabs
        value={tab}
        onChange={onTabChange}
        ariaLabel="Nội dung chi tiết khách hàng"
        items={[
          { label: 'Thông tin', icon: <InfoRoundedIcon className="!text-[18px]" /> },
          { label: 'Liên kết CRM', icon: <LinkRoundedIcon className="!text-[18px]" /> },
        ]}
      />

      <div className="bg-slate-50/60">
        {tab === 0 && (
          <div role="tabpanel" aria-label="Thông tin khách hàng" className="p-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                <CustomerDetailRow label="Tên khách hàng" value={customer.customerName} />
                <CustomerDetailRow label="Tên công ty" value={customer.companyName} />
                <CustomerDetailRow label="Số điện thoại" value={customer.phone} />
                <CustomerDetailRow label="Email" value={customer.email} />
                <CustomerDetailRow label="Người đại diện" value={customer.representativeName} />
                <CustomerDetailRow
                  label="Loại khách"
                  value={customer.customerTypeOption?.label || customer.customerType}
                />
                <CustomerDetailRow label="Mã số thuế" value={customer.taxCode} />
                <CustomerDetailRow label="CCCD/CMND" value={customer.identityNo} />
                <CustomerDetailRow label="Website" value={customer.website} />
                <CustomerDetailRow label="Ngày sinh" value={customer.birthday} />
              </dl>

              <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
                <CustomerDetailRow label="Địa chỉ" value={customer.address} />
                <CustomerDetailRow label="Ghi chú" value={customer.note} />
              </div>
            </section>
          </div>
        )}

        {tab === 1 && (
          <div role="tabpanel" aria-label="Liên kết CRM" className="p-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                <CustomerDetailRow
                  label="Lead nguồn"
                  value={customer.lead?.leadCode || customer.leadId}
                />
                <CustomerDetailRow
                  label="Nguồn phát sinh"
                  value={customer.sourceOption?.label || customer.source}
                />
                <CustomerDetailRow
                  label="Ngành"
                  value={customer.industryOption?.label || customer.industry}
                />
                <CustomerDetailRow label="Sales" value={customer.salesUser?.name} />
                <CustomerDetailRow label="Số dự án" value={customer.projectsCount} />
              </dl>

              {customer.leadId && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <DialogActionButton href={`/leads/${customer.leadId}`}>
                    Mở Lead nguồn
                  </DialogActionButton>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppDetailDialog>
  );
}

export function CustomerManager({
  customers,
  users,
  customerTypes,
  sources,
  industries,
  filters,
  page,
  totalPages,
  totalItems,
  pageSize,
  isFetching,
  isDeleting,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onDelete,
}: CustomerManagerProps) {
  const router = useRouter();
  const [viewTarget, setViewTarget] = useState<Customer | null>(null);
  const [viewTab, setViewTab] = useState(0);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const viewCustomerId = viewTarget?.id || '';
  const { data: viewCustomerDetail, isFetching: isFetchingViewCustomer } = useQuery<Customer>({
    queryKey: ['customers', viewCustomerId, 'quick-view'],
    queryFn: () => api.get(`/customers/${viewCustomerId}`).then((response) => response.data),
    enabled: Boolean(viewCustomerId),
  });

  const updateFilters = (nextFilters: Partial<CustomerFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
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

  const viewCustomer = (customer: Customer) => {
    setViewTarget(customer);
    setViewTab(0);
  };

  const viewActiveCustomer = () => {
    if (activeCustomer) viewCustomer(activeCustomer);
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
      <PageHeader title="Khách hàng" />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3  border-slate-200 p-4 lg:grid-cols-[minmax(260px,1fr)_repeat(4,176px)]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm mã, khách hàng, công ty, điện thoại, email..."
            value={filters.keyword}
            onChange={(value) => updateFilters({ keyword: value })}
          />

          <CompactSelectField
            label="Loại khách"
            value={filters.customer_type_option_id ? String(filters.customer_type_option_id) : ''}
            options={customerTypes.map((option) => ({
              value: String(option.id),
              label: option.label,
            }))}
            onChange={(value) => updateFilters({ customer_type_option_id: Number(value) || 0 })}
          />

          <CompactSelectField
            label="Nguồn"
            value={filters.source_option_id ? String(filters.source_option_id) : ''}
            options={sources.map((option) => ({
              value: String(option.id),
              label: option.label,
            }))}
            onChange={(value) => updateFilters({ source_option_id: Number(value) || 0 })}
          />

          <CompactSelectField
            label="Ngành"
            value={filters.industry_option_id ? String(filters.industry_option_id) : ''}
            options={industries.map((option) => ({
              value: String(option.id),
              label: option.label,
            }))}
            onChange={(value) => updateFilters({ industry_option_id: Number(value) || 0 })}
          />

          <CompactSelectField
            label="Sales"
            value={filters.sales_user_id ? String(filters.sales_user_id) : ''}
            options={users.map((user) => ({
              value: String(user.id),
              label: user.name || user.email || user.code || '-',
            }))}
            onChange={(value) => updateFilters({ sales_user_id: Number(value) || 0 })}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'customer',
              label: 'Khách hàng',
              className: 'sticky left-0 z-20 w-[300px] bg-slate-100',
            },
            { key: 'type', label: 'Loại', className: 'w-36' },
            { key: 'phone', label: 'Số điện thoại', className: 'w-36' },
            { key: 'email', label: 'Email', className: 'w-56' },
            { key: 'representative', label: 'Người đại diện', className: 'w-48' },
            { key: 'sales', label: 'Người phụ trách', className: 'w-44' },
            { key: 'actions', className: 'w-36' },
          ]}
          isLoading={isFetching}
          isEmpty={customers.length === 0}
          emptyText="Không có dữ liệu khách hàng"
          minWidthClassName="min-w-[1320px]"
        >
          {customers.map((customer) => {
            const customerIdentity = getCustomerIdentity(customer);

            return (
              <tr key={customer.id} className="group hover:bg-slate-50/80">
                <td className="sticky left-0 z-10 bg-white px-3 py-4 group-hover:bg-slate-50">
                  <EntityTableLink href={`/customers/${customer.id}`} title={customerIdentity}>
                    {customerIdentity}
                  </EntityTableLink>
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
                      size="small"
                      title="Xem chi tiết khách hàng"
                      onClick={() => viewCustomer(customer)}
                    >
                      <VisibilityRoundedIcon fontSize="small" />
                    </IconButton>
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
          })}
        </AppDataTable>

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
          <MenuItem onClick={viewActiveCustomer}>
            <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Xem chi tiết
          </MenuItem>
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

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </section>

      <CustomerViewDialog
        customer={viewCustomerDetail || viewTarget}
        tab={viewTab}
        isLoading={isFetchingViewCustomer}
        onTabChange={setViewTab}
        onClose={() => setViewTarget(null)}
      />
    </div>
  );
}
