'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { CustomerApiForm } from '@/features/customers/components/customer-api-form';
import { buildCustomerPayload, createEmptyCustomerFormValues } from '@/lib/customer-form-utils';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Customer, CustomerFormValues } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { Quotation } from '@/types/quotation';
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
    queryFn: () => api.get('/services', { params: { tree: true } }).then((response) => response.data),
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

  const {
    data: existingCustomers = [],
    isLoading: isExistingCustomerLoading,
  } = useQuery<Customer[]>({
    queryKey: ['customers', 'by-lead', leadId],
    queryFn: () =>
      api.get('/customers', { params: { lead_id: leadId } }).then((response) => response.data),
    enabled: Boolean(leadId),
    retry: false,
  });

  const { data: leadQuotations = [] } = useQuery<Quotation[]>({
    queryKey: ['quotations', 'by-lead', leadId],
    queryFn: () =>
      api.get('/quotations', { params: { lead_id: leadId } }).then((response) => response.data),
    enabled: Boolean(leadId),
  });

  const customerTypes = options.filter((option) => option.group === 'customer_type');
  const sources = options.filter((option) => option.group === 'lead_source');

  const defaultValues = useMemo(
    () => createEmptyCustomerFormValues(lead || null, services),
    [lead, services],
  );

  const existingCustomer = existingCustomers[0];
  const hasConvertedCustomer = Boolean(existingCustomer || lead?.convertedCustomerId);

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
      notify.error('Lead này đã được chuyển thành khách hàng');
      router.replace(`/leads/${leadId}`);
    }
  }, [hasConvertedCustomer, isLeadError, leadId, notify, router]);

  const createMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      if (!leadId || !lead) {
        throw new Error('Chỉ có thể tạo khách hàng từ một lead hợp lệ');
      }

      if (hasConvertedCustomer) {
        throw new Error('Lead này đã được chuyển thành khách hàng');
      }

      const response = await api.post<Customer>('/customers', buildCustomerPayload(values));
      const customer = response.data;

      await api.put(`/leads/${leadId}`, { convertedCustomerId: customer.id });

      return customer;
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      notify.success('Tạo khách hàng thành công');
      const quotationId = leadQuotations[0]?.id;
      const params = new URLSearchParams({ customerId: customer.id });

      if (quotationId) {
        params.set('quotationId', quotationId);
      }

      router.push(`/projects/new?${params.toString()}`);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Tạo khách hàng thất bại'));
    },
  });

  if (!leadId || isLeadError || hasConvertedCustomer || isLeadLoading || isExistingCustomerLoading) {
    return <ContentLoading />;
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">Thêm khách hàng</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Khách hàng</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Thêm mới</span>
        </div>
      </div>

      <CustomerApiForm
        mode="create"
        defaultValues={defaultValues}
        users={users}
        customerTypes={customerTypes}
        sources={sources}
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
      />
    </div>
  );
}
