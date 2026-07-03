'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import { Button } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { LeadForm } from '@/features/leads/components/lead-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { getUniqueLeadStatuses, toLeadPayload } from '@/lib/lead-utils';
import api from '@/services/api/client';
import type { Customer } from '@/types/customer';
import type { Lead, LeadFormValues } from '@/types/lead';
import type { AppOption } from '@/types/option';
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

  const { data: existingCustomers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', 'by-lead', id],
    queryFn: () => api.get('/customers', { params: { lead_id: id } }).then((response) => response.data),
    enabled: Boolean(id),
  });

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
  const statusOptions = leadOptions.filter((option) => option.group === 'lead_status');
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

  const updateMutation = useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const sourceOptionId = await ensureSourceOptionId(values);

      return api.put(`/leads/${id}`, toLeadPayload({ ...values, sourceOptionId }));
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

  if (leadLoading || usersLoading || optionsLoading || !lead) {
    return <ContentLoading />;
  }

  const hasConvertedCustomer = Boolean(lead.convertedCustomerId || existingCustomers.length > 0);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Chỉnh sửa lead</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Lead</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">{lead.customerName}</span>
          </div>
        </div>

        {!hasConvertedCustomer && (
          <Button
            component={Link}
            href={`/customers/new?leadId=${lead.id}`}
            variant="contained"
            startIcon={<AddBusinessRoundedIcon />}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            Tạo khách hàng
          </Button>
        )}
      </div>

      <LeadForm
        mode="edit"
        lead={lead}
        users={users}
        sources={sources}
        services={services}
        statuses={[
          ...statusOptions.map((status) => ({
            id: status.id,
            name: status.label,
            sortOrder: status.sortOrder || 0,
          })),
          ...getUniqueLeadStatuses([lead, ...leads]),
        ]}
        isSubmitting={updateMutation.isPending}
        onSubmit={(values) => updateMutation.mutate(values)}
      />
    </div>
  );
}