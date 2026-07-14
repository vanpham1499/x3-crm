'use client';

import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { LeadManager } from '@/features/leads/components/lead-manager';
import { useServerListState } from '@/hooks/use-server-list-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { getLeadParams } from '@/lib/lead-utils';
import api from '@/services/api/client';
import type { Lead, LeadFilters } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { PaginatedResponse } from '@/types/pagination';
import type { User } from '@/types/user';

const LEADS_PAGE_SIZE = 10;
const LEADS_LIST_QUERY_KEY = ['leads', 'list'] as const;

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const { filters, requestFilters, page, pageSize, setPage, setPageSize, onFiltersChange } =
    useServerListState<LeadFilters>({
      initialFilters: {
        keyword: '',
        status_id: '',
        status_option_id: '',
        assigned_user_id: '',
        source_id: '',
        source_option_id: '',
        industry_option_id: '',
        interested_service_option_id: '',
        interested_service_id: '',
      },
      queryKey: LEADS_LIST_QUERY_KEY,
      pageSize: LEADS_PAGE_SIZE,
    });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'lead-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: leadOptions = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'lead-list'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'lead_status,lead_source,lead_service' } })
        .then((response) => response.data),
  });
  const statuses = leadOptions.filter((option) => option.group === 'lead_status');
  const sources = leadOptions.filter((option) => option.group === 'lead_source');
  const services = leadOptions.filter((option) => option.group === 'lead_service');

  const {
    data: leadsPage,
    isFetching,
    isLoading,
  } = useQuery<PaginatedResponse<Lead>>({
    queryKey: [...LEADS_LIST_QUERY_KEY, requestFilters, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<Lead>>('/leads', {
          params: {
            ...getLeadParams(requestFilters),
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const leads = leadsPage?.data || [];
  const pagination = leadsPage?.meta || {
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
  }, [page, pagination.lastPage]);

  const deleteMutation = useMutation({
    mutationFn: (lead: Lead) => api.delete(`/leads/${lead.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      notify.success('Xóa lead thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa lead thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <LeadManager
      leads={leads}
      users={users}
      statuses={statuses}
      sources={sources}
      services={services}
      filters={filters}
      page={page}
      totalPages={pagination.lastPage}
      totalItems={pagination.total}
      pageSize={pageSize}
      isFetching={isFetching}
      isDeleting={deleteMutation.isPending}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onFiltersChange={onFiltersChange}
      onDelete={(lead) => deleteMutation.mutate(lead)}
    />
  );
}
