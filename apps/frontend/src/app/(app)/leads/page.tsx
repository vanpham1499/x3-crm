'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { LeadManager } from '@/features/leads/components/lead-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { getLeadParams } from '@/lib/lead-utils';
import api from '@/services/api/client';
import type { Lead, LeadFilters } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [filters, setFilters] = useState<LeadFilters>({
    keyword: '',
    status_id: '',
    status_option_id: '',
    assigned_user_id: '',
    source_id: '',
    source_option_id: '',
    industry_option_id: '',
    interested_service_option_id: '',
    interested_service_id: '',
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
    data: leads = [],
    isFetching,
    isLoading,
  } = useQuery<Lead[]>({
    queryKey: ['leads', filters],
    queryFn: () =>
      api.get('/leads', { params: getLeadParams(filters) }).then((response) => response.data),
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
      statuses={statuses}
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
