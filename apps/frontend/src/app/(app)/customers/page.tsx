'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { CustomerManager } from '@/features/customers/components/customer-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Customer, CustomerFilters } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

function getCustomerParams(filters: CustomerFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    customer_type_option_id: filters.customer_type_option_id || undefined,
    source_option_id: filters.source_option_id || undefined,
    industry_option_id: filters.industry_option_id || undefined,
    sales_user_id: filters.sales_user_id || undefined,
    lead_id: filters.lead_id || undefined,
  };
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [filters, setFilters] = useState<CustomerFilters>({
    keyword: '',
    customer_type_option_id: '',
    source_option_id: '',
    industry_option_id: '',
    sales_user_id: '',
    lead_id: '',
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'customer-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: options = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'customer-list'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'customer_type,lead_source,industry' } })
        .then((response) => response.data),
  });

  const customerTypes = options.filter((option) => option.group === 'customer_type');
  const sources = options.filter((option) => option.group === 'lead_source');
  const industries = options.filter((option) => option.group === 'industry');

  const {
    data: customers = [],
    isFetching,
    isLoading,
  } = useQuery<Customer[]>({
    queryKey: ['customers', filters],
    queryFn: () =>
      api.get('/customers', { params: getCustomerParams(filters) }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (customer: Customer) => api.delete(`/customers/${customer.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      notify.success('Xóa khách hàng thành công');
      setDeleteTarget(null);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa khách hàng thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <>
      <CustomerManager
        customers={customers}
        users={users}
        customerTypes={customerTypes}
        sources={sources}
        industries={industries}
        filters={filters}
        isFetching={isFetching}
        isDeleting={deleteMutation.isPending}
        onFiltersChange={setFilters}
        onDelete={setDeleteTarget}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa khách hàng?"
        description={`Bạn có chắc muốn xóa khách hàng "${deleteTarget?.customerName || deleteTarget?.customerCode || ''}"?`}
        confirmText="Xóa khách hàng"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
      />
    </>
  );
}
