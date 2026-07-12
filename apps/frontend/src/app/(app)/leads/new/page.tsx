'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
import { LeadForm } from '@/features/leads/components/lead-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { getUniqueLeadStatuses, toLeadPayload } from '@/lib/lead-utils';
import api from '@/services/api/client';
import type { Lead, LeadFormValues } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

export default function NewLeadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users', 'lead-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: leadOptions = [], isLoading: optionsLoading } = useQuery<AppOption[]>({
    queryKey: ['options', 'lead-form'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'lead_status,lead_source,lead_service' } })
        .then((response) => response.data),
  });
  const statuses = leadOptions.filter((option) => option.group === 'lead_status');
  const sources = leadOptions.filter((option) => option.group === 'lead_source');
  const services = leadOptions.filter((option) => option.group === 'lead_service');

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['leads', 'status-options'],
    queryFn: () => api.get('/leads').then((response) => response.data),
  });

  const ensureSourceOptionId = async (values: LeadFormValues) => {
    if (values.sourceOptionId) return values.sourceOptionId;

    const sourceName = values.sourceName.trim();
    if (!sourceName) return '';

    const existingSource = sources.find(
      (source) => source.label.trim().toLowerCase() === sourceName.toLowerCase(),
    );
    if (existingSource) return String(existingSource.id);

    const response = await api.post<AppOption>('/options', {
      group: 'lead_source',
      label: sourceName,
      value: sourceName,
      isActive: true,
    });
    queryClient.invalidateQueries({ queryKey: ['options'] });

    return String(response.data.id);
  };

  const createMutation = useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const sourceOptionId = await ensureSourceOptionId(values);

      return api.post('/leads', toLeadPayload({ ...values, sourceOptionId }));
    },
    onSuccess: () => {
      notify.success('Tạo lead thành công');
      router.push('/leads');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Tạo lead thất bại'));
    },
  });

  if (usersLoading || optionsLoading) {
    return <ContentLoading />;
  }

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
      <PageHeader title="Thêm lead" />

      <LeadForm
        mode="create"
        users={users}
        sources={sources}
        services={services}
        statuses={[
          ...statuses.map((status) => ({
            id: status.id,
            name: status.label,
            sortOrder: status.sortOrder || 0,
          })),
          ...getUniqueLeadStatuses(leads),
        ]}
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
      />
    </div>
  );
}
