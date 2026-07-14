'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CrmFlowBar } from '@/components/crm/crm-flow-bar';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
import { ProjectForm } from '@/features/projects/components/project-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { toProjectPayload } from '@/lib/project-utils';
import { SERVICE_QUOTE_CONFIG_GROUP } from '@/lib/service-quote-config';
import api from '@/services/api/client';
import type { Customer } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { ProjectFormValues, ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const customerId = searchParams.get('customerId') || '';
  const quotationId = searchParams.get('quotationId') || '';

  const { data: selectedCustomer, isLoading: isCustomerLoading } = useQuery<Customer>({
    queryKey: ['customers', 'project-form-initial', customerId],
    queryFn: () => api.get<Customer>(`/customers/${customerId}`).then((response) => response.data),
    enabled: Boolean(customerId),
  });

  const { data: services = [], isLoading: isServicesLoading } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'project-form-options'],
    queryFn: () =>
      api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['users', 'project-form-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: projectOptions = [], isLoading: isStatusesLoading } = useQuery<AppOption[]>({
    queryKey: ['options', 'project-create'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'project_status' } })
        .then((response) => response.data),
  });
  const statuses = projectOptions.filter((option) => option.group === 'project_status');

  const { data: quoteConfigs = [] } = useQuery<AppOption[]>({
    queryKey: ['options', SERVICE_QUOTE_CONFIG_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SERVICE_QUOTE_CONFIG_GROUP } })
        .then((response) => response.data),
  });

  const { data: quotations = [], isLoading: isQuotationsLoading } = useQuery<Quotation[]>({
    queryKey: ['quotations', 'project-create-options'],
    queryFn: () => api.get<Quotation[]>('/quotations').then((response) => response.data),
  });

  const contextualQuotations = customerId
    ? quotations.filter(
        (item) =>
          String(item.customerId || '') === customerId ||
          (!item.customerId &&
            selectedCustomer?.leadId &&
            String(item.leadId || '') === String(selectedCustomer.leadId)),
      )
    : quotations;

  const quotation = contextualQuotations.find(
    (item) => String(item.id) === quotationId && !item.projectId && Boolean(item.customerId),
  );

  const quotationMetadata = quotation?.metadata || {};
  const defaultValues: Partial<ProjectFormValues> = {
    customerId: quotation?.customerId ? String(quotation.customerId) : customerId,
    quotationId: quotation ? String(quotation.id) : '',
    serviceId: quotation?.serviceId ? String(quotation.serviceId) : '',
    projectType: quotationMetadata.projectType === 'M' ? 'M' : 'K',
    projectName:
      typeof quotationMetadata.projectName === 'string' && quotationMetadata.projectName
        ? quotationMetadata.projectName
        : quotation?.serviceName || '',
  };

  const createMutation = useMutation({
    mutationFn: (values: ProjectFormValues) =>
      api
        .post<ProjectItem>('/projects', toProjectPayload(values))
        .then((response) => response.data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      notify.success('Tạo dự án thành công');
      router.push(`/projects/${project.id}`);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Tạo dự án thất bại'));
    },
  });

  if (
    isCustomerLoading ||
    isServicesLoading ||
    isUsersLoading ||
    isStatusesLoading ||
    isQuotationsLoading
  ) {
    return <ContentLoading />;
  }

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
      <PageHeader title="Thêm dự án" />

      {customerId && selectedCustomer && (
        <CrmFlowBar
          steps={[
            {
              label: 'Lead',
              state: selectedCustomer.leadId ? 'done' : 'pending',
              href: selectedCustomer.leadId ? `/leads/${selectedCustomer.leadId}` : undefined,
            },
            {
              label: 'Customer',
              state: 'done',
              href: `/customers/${selectedCustomer.id}`,
            },
            { label: 'Dự án', state: 'active' },
          ]}
        />
      )}

      <ProjectForm
        mode="create"
        initialCustomer={selectedCustomer || quotation?.customer || null}
        services={services}
        users={users}
        statuses={statuses}
        quoteConfigs={quoteConfigs}
        quotations={contextualQuotations}
        defaultValues={defaultValues}
        cancelHref={customerId ? `/customers/${customerId}` : '/projects'}
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutateAsync(values)}
      />
    </div>
  );
}
