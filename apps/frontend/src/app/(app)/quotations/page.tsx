'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { QuotationManager } from '@/features/quotations/components/quotation-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Quotation, QuotationFilters } from '@/types/quotation';

function quotationParams(filters: QuotationFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
  };
}

export default function QuotationsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [filters, setFilters] = useState<QuotationFilters>({ keyword: '', status: '' });

  const {
    data: quotations = [],
    isFetching,
    isLoading,
  } = useQuery<Quotation[]>({
    queryKey: ['quotations', filters],
    queryFn: () =>
      api
        .get<Quotation[]>('/quotations', { params: quotationParams(filters) })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (quotation: Quotation) => api.delete(`/quotations/${quotation.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      notify.success('Xóa báo giá thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa báo giá thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <QuotationManager
      quotations={quotations}
      filters={filters}
      isFetching={isFetching}
      isDeleting={deleteMutation.isPending}
      onFiltersChange={setFilters}
      onDelete={(quotation) => deleteMutation.mutate(quotation)}
    />
  );
}

