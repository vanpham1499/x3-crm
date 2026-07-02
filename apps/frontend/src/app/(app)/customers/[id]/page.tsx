import { notFound } from 'next/navigation';
import customers from '@/data/customers.json';
import { CustomerForm } from '@/features/customers/components/customer-form';
import { customerToFormValues } from '@/lib/customer-form-utils';
import type { Customer } from '@/types/customer';

const customerRows = customers as Customer[];

export default function EditCustomerPage({ params }: { params: { id: string } }) {
  const customer = customerRows.find((item) => item.leadCode === params.id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">Chỉnh sửa khách hàng</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Khách hàng</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">{customer.customerCode}</span>
        </div>
      </div>

      <CustomerForm mode="edit" leadCode={customer.leadCode} defaultValues={customerToFormValues(customer)} />
    </div>
  );
}
