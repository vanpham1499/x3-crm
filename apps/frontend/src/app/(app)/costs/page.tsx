'use client';

import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { CostManager } from '@/features/costs/components/cost-manager';
import { useServerListState } from '@/hooks/use-server-list-state';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { PaginatedResponse } from '@/types/pagination';
import type { ProjectCost, ProjectCostFilters } from '@/types/project-cost';

const COSTS_PAGE_SIZE = 10;
const COSTS_LIST_QUERY_KEY = ['project-costs', 'list'] as const;
const DEFAULT_COST_FILTERS: ProjectCostFilters = {
  keyword: '',
  entry_type: '',
  status: '',
  reconciled_status: '',
  date_from: '',
  date_to: '',
};

function costParams(filters: ProjectCostFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    entry_type: filters.entry_type || undefined,
    status: filters.status || undefined,
    reconciled_status: filters.reconciled_status || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    group_by_project: 1,
  };
}

export default function CostsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const { filters, requestFilters, page, pageSize, setPage, setPageSize, onFiltersChange } =
    useServerListState<ProjectCostFilters>({
      initialFilters: DEFAULT_COST_FILTERS,
      queryKey: COSTS_LIST_QUERY_KEY,
      pageSize: COSTS_PAGE_SIZE,
    });
  const {
    data: costsPage,
    isFetching,
    isLoading,
  } = useQuery<PaginatedResponse<ProjectCost>>({
    queryKey: [...COSTS_LIST_QUERY_KEY, requestFilters, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<ProjectCost>>('/project-costs', {
          params: {
            ...costParams(requestFilters),
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const costs = costsPage?.data || [];
  const pagination = costsPage?.meta || {
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

  const reconcileMutation = useMutation({
    mutationFn: (costId: number) =>
      api.post<ProjectCost>(`/project-costs/${costId}/reconcile`).then((response) => response.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-costs'] });
      notify.success('Đã xác nhận khớp khoản chi');
    },
    onError: (error) =>
      notify.error(getApiErrorMessage(error, 'Không thể xác nhận đối soát khoản chi')),
  });

  return (
    <CostManager
      costs={costs}
      filters={filters}
      page={page}
      pageSize={pageSize}
      totalPages={pagination.lastPage}
      totalItems={pagination.total}
      isFetching={isFetching || isLoading}
      onFiltersChange={onFiltersChange}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      isReconciling={reconcileMutation.isPending}
      onReconcile={(costId) => reconcileMutation.mutateAsync(costId)}
    />
  );
}
