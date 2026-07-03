'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
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
    if (existingSource) return existingSource.id;

    const response = await api.post<AppOption>('/options', {
      group: 'lead_source',
      label: sourceName,
      value: sourceName,
      isActive: true,
    });
    queryClient.invalidateQueries({ queryKey: ['options'] });

    return response.data.id;
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
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">Thêm lead</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Lead</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Thêm mới</span>
        </div>
      </div>

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
