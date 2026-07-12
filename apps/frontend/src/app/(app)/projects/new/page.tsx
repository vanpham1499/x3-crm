'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
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

  const { data: customers = [], isLoading: isCustomersLoading } = useQuery<Customer[]>({
    queryKey: ['customers', 'project-form-options'],
    queryFn: () => api.get('/customers').then((response) => response.data),
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

  const quotation = quotations.find(
    (item) =>
      String(item.id) === quotationId &&
      !item.projectId &&
      Boolean(item.customerId) &&
      item.status !== 'lost',
  );

  const quotationMetadata = quotation?.metadata || {};
  const defaultValues: Partial<ProjectFormValues> = {
    customerId: quotation?.customerId ? String(quotation.customerId) : customerId,
    quotationId: quotation ? String(quotation.id) : '',
    serviceId: quotation?.serviceId ? String(quotation.serviceId) : '',
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
    isCustomersLoading ||
    isServicesLoading ||
    isUsersLoading ||
    isStatusesLoading ||
    isQuotationsLoading
  ) {
    return <ContentLoading />;
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">Thêm dự án</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Dự án</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Thêm mới</span>
        </div>
      </div>

      <ProjectForm
        mode="create"
        customers={customers}
        services={services}
        users={users}
        statuses={statuses}
        quoteConfigs={quoteConfigs}
        quotations={quotations}
        defaultValues={defaultValues}
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
      />
    </div>
  );
}
