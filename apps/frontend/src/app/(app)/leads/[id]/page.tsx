'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { LeadForm } from '@/features/leads/components/lead-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { getUniqueLeadStatuses, toLeadPayload } from '@/lib/lead-utils';
import api from '@/services/api/client';
import type { CustomerSourceOption, Lead, LeadFormValues } from '@/types/lead';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

export default function EditLeadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const id = params.id;

  const { data: lead, isLoading: leadLoading } = useQuery<Lead>({
    queryKey: ['leads', id],
    queryFn: () => api.get(`/leads/${id}`).then((response) => response.data),
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users', 'lead-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: sources = [], isLoading: sourcesLoading } = useQuery<CustomerSourceOption[]>({
    queryKey: ['customer-sources'],
    queryFn: () => api.get('/customer-sources').then((response) => response.data),
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'lead-options'],
    queryFn: () => api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['leads', 'status-options'],
    queryFn: () => api.get('/leads').then((response) => response.data),
  });

  const ensureSourceId = async (values: LeadFormValues) => {
    if (values.sourceId) return values.sourceId;

    const sourceName = values.sourceName.trim();
    if (!sourceName) return '';

    const existingSource = sources.find(
      (source) => source.name.trim().toLowerCase() === sourceName.toLowerCase(),
    );
    if (existingSource) return existingSource.id;

    const response = await api.post<CustomerSourceOption>('/customer-sources', { name: sourceName });
    queryClient.invalidateQueries({ queryKey: ['customer-sources'] });

    return response.data.id;
  };

  const updateMutation = useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const sourceId = await ensureSourceId(values);

      return api.put(`/leads/${id}`, toLeadPayload({ ...values, sourceId }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', id] });
      notify.success('Cập nhật lead thành công');
      router.push('/leads');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật lead thất bại'));
    },
  });

  if (leadLoading || usersLoading || sourcesLoading || servicesLoading || !lead) {
    return <ContentLoading />;
  }

  const statuses = getUniqueLeadStatuses([lead, ...leads]);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">Chỉnh sửa lead</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Lead</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">{lead.customerName}</span>
        </div>
      </div>

      <LeadForm
        mode="edit"
        lead={lead}
        users={users}
        sources={sources}
        services={services}
        statuses={statuses}
        isSubmitting={updateMutation.isPending}
        onSubmit={(values) => updateMutation.mutate(values)}
      />
    </div>
  );
}
