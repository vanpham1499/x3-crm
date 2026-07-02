import customers from '@/data/customers.json';
import { CustomerList } from '@/features/customers/components/customer-list';
import type { Customer } from '@/types/customer';

const customerRows = customers as Customer[];

export default function CustomersPage() {
  return <CustomerList customers={customerRows} />;
}
