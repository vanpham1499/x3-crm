'use client';

import { useParams } from 'next/navigation';
import { Alert } from '@mui/material';
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
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

export default function EditProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', 'project-form-options'],
    queryFn: () => api.get('/customers').then((response) => response.data),
  });

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'project-form-options'],
    queryFn: () => api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'project-form-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: projectOptions = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'project-form'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'project_status,contract_status' } })
        .then((response) => response.data),
  });
  const statuses = projectOptions.filter((option) => option.group === 'project_status');
  const contractStatuses = projectOptions.filter((option) => option.group === 'contract_status');

  const { data: quoteConfigs = [] } = useQuery<AppOption[]>({
    queryKey: ['options', SERVICE_QUOTE_CONFIG_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SERVICE_QUOTE_CONFIG_GROUP } })
        .then((response) => response.data),
  });

  const { data: project, isLoading } = useQuery<ProjectItem>({
    queryKey: ['projects', id],
    queryFn: () => api.get(`/projects/${id}`).then((response) => response.data),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProjectFormValues) =>
      api.put<ProjectItem>(`/projects/${id}`, toProjectPayload(values)).then((response) => response.data),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData(['projects', id], updatedProject);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      notify.success('Cập nhật dự án thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật dự án thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  if (!project) {
    return (
      <div className="p-6">
        <Alert severity="error">Không tìm thấy dự án</Alert>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">Chỉnh sửa dự án</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Dự án</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">{project.projectCode || project.projectName}</span>
        </div>
      </div>

      <ProjectForm
        mode="edit"
        project={project}
        customers={customers}
        services={services}
        users={users}
        statuses={statuses}
        contractStatuses={contractStatuses}
        quoteConfigs={quoteConfigs}
        isSubmitting={updateMutation.isPending}
        onSubmit={(values) => updateMutation.mutate(values)}
      />
    </div>
  );
}
