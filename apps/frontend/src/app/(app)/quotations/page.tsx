'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { QuotationManager } from '@/features/quotations/components/quotation-manager';
import { useServerListState } from '@/hooks/use-server-list-state';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { PaginatedResponse } from '@/types/pagination';
import type { Quotation, QuotationFilters } from '@/types/quotation';
import type { User } from '@/types/user';

const QUOTATIONS_PAGE_SIZE = 10;
const QUOTATIONS_LIST_QUERY_KEY = ['quotations', 'list'] as const;
const DEFAULT_QUOTATION_FILTERS: QuotationFilters = { keyword: '', status: '', created_by: '' };

function quotationParams(filters: QuotationFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
    created_by: filters.created_by || undefined,
  };
}

export default function QuotationsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const [isExporting, setIsExporting] = useState(false);
  const { filters, requestFilters, page, pageSize, setPage, setPageSize, onFiltersChange } =
    useServerListState<QuotationFilters>({
      initialFilters: DEFAULT_QUOTATION_FILTERS,
      queryKey: QUOTATIONS_LIST_QUERY_KEY,
      pageSize: QUOTATIONS_PAGE_SIZE,
    });

  const { data: creators = [] } = useQuery<User[]>({
    queryKey: ['users', 'quotation-filter-options'],
    queryFn: () =>
      api.get<User[]>('/users/lookup?context=quotation').then((response) => response.data),
  });

  const {
    data: quotationsPage,
    isFetching,
    isLoading,
  } = useQuery<PaginatedResponse<Quotation>>({
    queryKey: [...QUOTATIONS_LIST_QUERY_KEY, requestFilters, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<Quotation>>('/quotations', {
          params: {
            ...quotationParams(requestFilters),
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const quotations = quotationsPage?.data || [];
  const pagination = quotationsPage?.meta || {
    currentPage: page,
    lastPage: 1,
    perPage: pageSize,
    total: 0,
    from: null,
    to: null,
  };

  useEffect(() => {
    if (page > pagination.lastPage) {
      setPage(Math.max(1, pagination.lastPage));
    }
  }, [page, pagination.lastPage, setPage]);

  const deleteMutation = useMutation({
    mutationFn: (quotation: Quotation) => api.delete(`/quotations/${quotation.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      notify.success('Xóa báo phí thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa báo phí thất bại'));
    },
  });

  const exportQuotations = async () => {
    setIsExporting(true);

    try {
      const { exportQuotationsWorkbook } =
        await import('@/features/quotations/lib/export-quotations');
      await exportQuotationsWorkbook(requestFilters);
      notify.success('Đã xuất file Excel báo phí.');
    } catch (error) {
      notify.error(getApiErrorMessage(error, 'Không thể xuất file Excel báo phí.'));
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <QuotationManager
      quotations={quotations}
      filters={filters}
      page={page}
      totalPages={pagination.lastPage}
      totalItems={pagination.total}
      pageSize={pageSize}
      isFetching={isFetching}
      isDeleting={deleteMutation.isPending}
      isExporting={isExporting}
      currentUser={currentUser}
      creators={creators}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onFiltersChange={onFiltersChange}
      onExport={() => void exportQuotations()}
      onDelete={(quotation) => deleteMutation.mutate(quotation)}
    />
  );
}
