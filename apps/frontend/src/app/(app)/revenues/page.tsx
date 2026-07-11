'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { RevenueManager } from '@/features/revenues/components/revenue-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { DEFAULT_REVENUE_FILTERS } from '@/lib/revenue-utils';
import api from '@/services/api/client';
import type { Revenue, RevenueFilters } from '@/types/revenue';

function revenueParams(filters: RevenueFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    project_id: filters.project_id || undefined,
    payment_status: filters.payment_status || undefined,
    invoice_status: filters.invoice_status || undefined,
  };
}

export default function RevenuesPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [filters, setFilters] = useState<RevenueFilters>(DEFAULT_REVENUE_FILTERS);

  const {
    data: revenues = [],
    isFetching,
    isLoading,
  } = useQuery<Revenue[]>({
    queryKey: ['revenues', filters],
    queryFn: () =>
      api.get<Revenue[]>('/revenues', { params: revenueParams(filters) }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (revenue: Revenue) => api.delete(`/revenues/${revenue.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      notify.success('Xóa doanh thu thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa doanh thu thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <RevenueManager
      revenues={revenues}
      filters={filters}
      isFetching={isFetching}
      isDeleting={deleteMutation.isPending}
      onFiltersChange={setFilters}
      onDelete={(revenue) => deleteMutation.mutate(revenue)}
    />
  );
}
