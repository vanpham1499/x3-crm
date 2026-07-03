'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { LeadManager } from '@/features/leads/components/lead-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { getLeadParams } from '@/lib/lead-utils';
import api from '@/services/api/client';
import type { CustomerSourceOption, Lead, LeadFilters } from '@/types/lead';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [filters, setFilters] = useState<LeadFilters>({
    keyword: '',
    status_id: '',
    assigned_user_id: '',
    source_id: '',
    interested_service_id: '',
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'lead-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: sources = [] } = useQuery<CustomerSourceOption[]>({
    queryKey: ['customer-sources'],
    queryFn: () => api.get('/customer-sources').then((response) => response.data),
  });

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'lead-options'],
    queryFn: () => api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: leads = [], isFetching, isLoading } = useQuery<Lead[]>({
    queryKey: ['leads', filters],
    queryFn: () => api.get('/leads', { params: getLeadParams(filters) }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

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
      sources={sources}
      services={services}
      filters={filters}
      isFetching={isFetching}
      isDeleting={deleteMutation.isPending}
      onFiltersChange={setFilters}
      onDelete={(lead) => deleteMutation.mutate(lead)}
    />
  );
}
