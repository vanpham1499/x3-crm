'use client';

import Link from 'next/link';
import type { Customer } from '@/types/customer';
import type { ProjectItem } from '@/types/project';

function valueOrDash(value?: string | null) {
  return value?.trim() || '-';
}

function InfoCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {valueOrDash(value)}
      </p>
    </div>
  );
}

function InfoSection({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string | null | undefined]>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-950">
        {title}
      </h2>
      <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {items.map(([label, value]) => (
          <InfoCell key={label} label={label} value={value} />
        ))}
      </div>
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
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm font-semibold text-slate-500">
        Không tìm thấy thông tin khách hàng của dự án.
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold text-slate-950">
            {customer.customerName || customer.companyName}
          </p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{customer.customerCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {customer.leadId ? (
            <Link
              href={`/leads/${customer.leadId}`}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Mở Lead
            </Link>
          ) : null}
          <Link
            href={`/customers/${customer.id}`}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            Mở hồ sơ khách hàng
          </Link>
        </div>
      </div>

      <InfoSection
        title="Thông tin khách hàng"
        items={[
          ['Mã khách hàng', customer.customerCode],
          ['Tên khách hàng', customer.customerName],
          ['Loại khách hàng', customer.customerTypeOption?.label || customer.customerType],
          ['Sales phụ trách', customer.salesUser?.name || project.salesUser?.name],
        ]}
      />

      <InfoSection
        title="Liên hệ"
        items={[
          ['Số điện thoại', customer.phone],
          ['Email', customer.email],
          ['Website', customer.website],
          ['Địa chỉ', customer.address],
        ]}
      />

      <InfoSection
        title="Pháp lý & hóa đơn"
        items={[
          ['Tên công ty', customer.companyName],
          ['Người đại diện', customer.representativeName],
          ['Mã số thuế', customer.taxCode],
          ['CCCD/CMND', customer.identityNo],
        ]}
      />

      <InfoSection
        title="CRM"
        items={[
          ['Nguồn khách hàng', customer.sourceOption?.label || customer.source],
          ['Ngành nghề', customer.industryOption?.label || customer.industry],
          ['Ngày tạo', customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('vi-VN') : null],
          ['Ghi chú', customer.note],
        ]}
      />
    </div>
  );
}
