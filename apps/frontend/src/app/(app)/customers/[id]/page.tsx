'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Alert } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CrmFlowBar } from '@/components/crm/crm-flow-bar';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
import { CustomerApiForm } from '@/features/customers/components/customer-api-form';
import { buildCustomerPayload, customerToFormValues } from '@/lib/customer-form-utils';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Customer, CustomerFormValues } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

export default function EditCustomerPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'customer-form-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: options = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'customer-form'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'customer_type,lead_source,industry' } })
        .then((response) => response.data),
  });

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ['customers', id],
    queryFn: () => api.get(`/customers/${id}`).then((response) => response.data),
  });

  const customerTypes = options.filter((option) => option.group === 'customer_type');
  const sources = options.filter((option) => option.group === 'lead_source');

  const defaultValues = useMemo(
    () => (customer ? customerToFormValues(customer) : null),
    [customer],
  );

  const updateMutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      api.put(`/customers/${id}`, buildCustomerPayload(values)),
    onSuccess: (response) => {
      queryClient.setQueryData(['customers', id], response.data);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      notify.success('Cập nhật khách hàng thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật khách hàng thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  if (!customer || !defaultValues) {
    return (
      <div className="p-6">
        <Alert severity="error">Không tìm thấy khách hàng</Alert>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
      <PageHeader
        title={customer.customerName || customer.companyName}
        currentLabel="Hồ sơ"
        eyebrow={
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            Customer {customer.customerCode}
          </span>
        }
      />

      <CrmFlowBar
        steps={[
          {
            label: 'Lead',
            state: customer.leadId ? 'done' : 'pending',
            href: customer.leadId ? `/leads/${customer.leadId}` : undefined,
          },
          { label: 'Customer', state: 'active', href: `/customers/${customer.id}` },
        ]}
      />

      <CustomerApiForm
        mode="edit"
        customer={customer}
        defaultValues={defaultValues}
        users={users}
        customerTypes={customerTypes}
        sources={sources}
        isSubmitting={updateMutation.isPending}
        onSubmit={(values) => updateMutation.mutate(values)}
      />
    </div>
  );
}
