'use client';

import type { ReactNode } from 'react';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import { TabActionButton } from '@/components/actions/tab-action-button';
import type { Customer } from '@/types/customer';
import type { ProjectItem } from '@/types/project';

type CustomerDetail = {
  label: string;
  value: ReactNode;
};

function textOrDash(value?: string | null) {
  return value?.trim() || '-';
}

function externalUrl(value?: string | null) {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function CustomerDetailRow({ label, value }: CustomerDetail) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 border-t border-slate-100 py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[104px_minmax(0,1fr)] xl:grid-cols-[120px_minmax(0,1fr)]">
      <dt className="text-xs font-semibold leading-5 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold leading-5 text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function CustomerDetailGroup({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: CustomerDetail[];
}) {
  return (
    <section className="min-w-0 px-5 py-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </span>
        <h3 className="text-sm font-extrabold text-slate-950">{title}</h3>
      </div>
      <dl>
        {items.map((item) => (
          <CustomerDetailRow key={item.label} {...item} />
        ))}
      </dl>
    </section>
  );
}

export function ProjectCustomerPanel({
  project,
  customer,
}: {
  project: ProjectItem;
  customer?: Customer | null;
}) {
  if (!customer) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm font-semibold text-slate-500 shadow-sm">
        Không tìm thấy thông tin khách hàng của dự án.
      </section>
    );
  }

  const customerName = customer.customerName || customer.companyName || '-';
  const customerIdentity = [customer.customerCode, customerName].filter(Boolean).join('.');
  const customerType = customer.customerTypeOption?.label || customer.customerType;
  const salesUser = customer.salesUser || project.salesUser;
  const salesLabel = [salesUser?.code, salesUser?.name].filter(Boolean).join(' - ');
  const createdDate = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString('vi-VN')
    : null;

  const contactItems: CustomerDetail[] = [
    {
      label: 'Điện thoại',
      value: customer.phone ? (
        <a className="text-blue-700 hover:underline" href={`tel:${customer.phone}`}>
          {customer.phone}
        </a>
      ) : (
        '-'
      ),
    },
    {
      label: 'Email',
      value: customer.email ? (
        <a className="text-blue-700 hover:underline" href={`mailto:${customer.email}`}>
          {customer.email}
        </a>
      ) : (
        '-'
      ),
    },
    {
      label: 'Website',
      value: customer.website ? (
        <a
          className="break-all text-blue-700 hover:underline"
          href={externalUrl(customer.website)}
          target="_blank"
          rel="noreferrer"
        >
          {customer.website}
        </a>
      ) : (
        '-'
      ),
    },
    { label: 'Địa chỉ', value: textOrDash(customer.address) },
  ];

  const legalItems: CustomerDetail[] = [
    { label: 'Tên pháp nhân', value: textOrDash(customer.companyName) },
    { label: 'Người đại diện', value: textOrDash(customer.representativeName) },
    { label: 'Mã số thuế', value: textOrDash(customer.taxCode) },
    { label: 'CCCD/CMND', value: textOrDash(customer.identityNo) },
  ];

  const crmItems: CustomerDetail[] = [
    {
      label: 'Sales',
      value: (
        <span className="block truncate whitespace-nowrap" title={salesLabel || undefined}>
          {textOrDash(salesLabel)}
        </span>
      ),
    },
    {
      label: 'Nguồn',
      value: textOrDash(customer.sourceOption?.label || customer.source),
    },
    {
      label: 'Ngành nghề',
      value: textOrDash(customer.industryOption?.label || customer.industry),
    },
    { label: 'Ngày tạo', value: textOrDash(createdDate) },
    { label: 'Ghi chú', value: textOrDash(customer.note) },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-extrabold text-slate-950" title={customerIdentity}>
            {customerIdentity}
          </h2>
          {customerType ? (
            <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
              {customerType}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {customer.leadId ? (
            <TabActionButton href={`/leads/${customer.leadId}`} tone="secondary">
              Mở Lead
            </TabActionButton>
          ) : null}
          <TabActionButton href={`/customers/${customer.id}`}>Mở hồ sơ khách hàng</TabActionButton>
        </div>
      </header>

      <div className="grid divide-y divide-slate-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <CustomerDetailGroup
          icon={<ContactPhoneOutlinedIcon fontSize="small" />}
          title="Liên hệ"
          items={contactItems}
        />
        <CustomerDetailGroup
          icon={<BusinessOutlinedIcon fontSize="small" />}
          title="Pháp lý & hóa đơn"
          items={legalItems}
        />
        <CustomerDetailGroup
          icon={<ManageAccountsOutlinedIcon fontSize="small" />}
          title="CRM & phụ trách"
          items={crmItems}
        />
      </div>
    </section>
  );
}
