import customers from '@/data/customers.json';
import { CustomerList } from '@/features/customers/components/customer-list';
import type { Customer } from '@/types/customer';

const leadRows = customers as Customer[];

export default function LeadsPage() {
  return (
    <CustomerList
      customers={leadRows}
      title="Lead"
      breadcrumbLabel="Lead"
      createLabel="Thêm lead"
      createHref="/leads/new"
      editBasePath="/leads"
      searchPlaceholder="Tìm lead, số điện thoại, website, nguồn, dịch vụ..."
      totalLabel="lead"
      primaryColumnLabel="Lead"
      editTitle="Chỉnh sửa lead"
    />
  );
}
