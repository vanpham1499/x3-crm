'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Button } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CrmFlowBar } from '@/components/crm/crm-flow-bar';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
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
    queryFn: () =>
      api.get('/customers', { params: { lead_id: id } }).then((response) => response.data),
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

  const convertedCustomerId =
    lead.convertedCustomer?.id || lead.convertedCustomerId || existingCustomers[0]?.id;

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
      <PageHeader
        title={lead.customerName}
        currentLabel="Hồ sơ"
        eyebrow={
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            Lead {lead.leadCode || lead.id}
          </span>
        }
      />

      <CrmFlowBar
        steps={[
          {
            label: 'Lead',
            state: convertedCustomerId ? 'done' : 'active',
            href: `/leads/${lead.id}`,
          },
          {
            label: 'Customer',
            state: convertedCustomerId ? 'active' : 'pending',
            href: convertedCustomerId ? `/customers/${convertedCustomerId}` : undefined,
          },
          { label: 'Dự án', state: 'pending' },
        ]}
        action={
          <Button
            component={Link}
            href={
              convertedCustomerId
                ? `/customers/${convertedCustomerId}`
                : `/customers/new?leadId=${lead.id}`
            }
            variant="contained"
            startIcon={
              convertedCustomerId ? <ArrowForwardRoundedIcon /> : <AddBusinessRoundedIcon />
            }
            className="brand-blue-action"
          >
            {convertedCustomerId ? 'Mở khách hàng' : 'Chuyển thành khách hàng'}
          </Button>
        }
      />

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
        onSubmit={(values) => updateMutation.mutateAsync(values)}
      />
    </div>
  );
}
