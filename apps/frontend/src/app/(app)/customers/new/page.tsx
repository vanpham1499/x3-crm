'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CrmFlowBar } from '@/components/crm/crm-flow-bar';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
import { CustomerApiForm } from '@/features/customers/components/customer-api-form';
import { buildCustomerPayload, createEmptyCustomerFormValues } from '@/lib/customer-form-utils';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Customer, CustomerFormValues } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

export default function NewCustomerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const leadId = searchParams.get('leadId') || '';

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

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'customer-code-tree'],
    queryFn: () =>
      api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const {
    data: lead,
    isError: isLeadError,
    isLoading: isLeadLoading,
  } = useQuery<Lead>({
    queryKey: ['leads', leadId, 'customer-create'],
    queryFn: () => api.get(`/leads/${leadId}`).then((response) => response.data),
    enabled: Boolean(leadId),
    retry: false,
  });

  const { data: existingCustomers = [], isLoading: isExistingCustomerLoading } = useQuery<
    Customer[]
  >({
    queryKey: ['customers', 'by-lead', leadId],
    queryFn: () =>
      api.get('/customers', { params: { lead_id: leadId } }).then((response) => response.data),
    enabled: Boolean(leadId),
    retry: false,
  });

  const customerTypes = options.filter((option) => option.group === 'customer_type');
  const sources = options.filter((option) => option.group === 'lead_source');

  const defaultValues = useMemo(
    () => createEmptyCustomerFormValues(lead || null, services),
    [lead, services],
  );

  const existingCustomer = existingCustomers[0];
  const convertedCustomerId =
    existingCustomer?.id || lead?.convertedCustomer?.id || lead?.convertedCustomerId;
  const hasConvertedCustomer = Boolean(convertedCustomerId);

  useEffect(() => {
    if (!leadId) {
      notify.error('Chỉ có thể tạo khách hàng từ một lead hợp lệ');
      router.replace('/leads');
      return;
    }

    if (isLeadError) {
      notify.error('Lead không tồn tại hoặc đã bị xóa');
      router.replace('/leads');
      return;
    }

    if (hasConvertedCustomer) {
      router.replace(`/customers/${convertedCustomerId}`);
    }
  }, [convertedCustomerId, hasConvertedCustomer, isLeadError, leadId, notify, router]);

  const createMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      if (!leadId || !lead) {
        throw new Error('Chỉ có thể tạo khách hàng từ một lead hợp lệ');
      }

      if (hasConvertedCustomer) {
        throw new Error('Lead này đã được chuyển thành khách hàng');
      }

      return api
        .post<Customer>('/customers', buildCustomerPayload(values))
        .then((response) => response.data);
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      notify.success('Tạo khách hàng thành công');
      router.push(`/customers/${customer.id}`);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Tạo khách hàng thất bại'));
    },
  });

  if (
    !leadId ||
    isLeadError ||
    hasConvertedCustomer ||
    isLeadLoading ||
    isExistingCustomerLoading
  ) {
    return <ContentLoading />;
  }

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
      <PageHeader
        title="Chuyển Lead thành khách hàng"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: `Lead ${lead?.leadCode || leadId}`, href: `/leads/${leadId}` },
          { label: 'Tạo Customer' },
        ]}
      />

      <CrmFlowBar
        steps={[
          { label: 'Lead', state: 'done', href: `/leads/${leadId}` },
          { label: 'Customer', state: 'active' },
          { label: 'Dự án', state: 'pending' },
        ]}
      />

      <CustomerApiForm
        mode="create"
        defaultValues={defaultValues}
        users={users}
        customerTypes={customerTypes}
        sources={sources}
        cancelHref={`/leads/${leadId}`}
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutateAsync(values)}
      />
    </div>
  );
}
