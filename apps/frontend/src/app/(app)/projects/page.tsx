'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { ProjectManager } from '@/features/projects/components/project-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { DEFAULT_PROJECT_FILTERS } from '@/lib/project-utils';
import api from '@/services/api/client';
import type { Customer } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { ProjectFilters, ProjectItem } from '@/types/project';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

function getProjectParams(filters: ProjectFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    customer_id: filters.customer_id || undefined,
    service_id: filters.service_id || undefined,
    status_option_id: filters.status_option_id || undefined,
    manager_user_id: filters.manager_user_id || undefined,
    sales_user_id: filters.sales_user_id || undefined,
  };
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [filters, setFilters] = useState<ProjectFilters>(DEFAULT_PROJECT_FILTERS);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', 'project-options'],
    queryFn: () => api.get('/customers').then((response) => response.data),
  });

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'project-options'],
    queryFn: () => api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'project-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: statuses = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'project_status'],
    queryFn: () =>
      api.get('/options', { params: { groups: 'project_status' } }).then((response) => response.data),
  });

  const {
    data: projects = [],
    isFetching,
    isLoading,
  } = useQuery<ProjectItem[]>({
    queryKey: ['projects', filters],
    queryFn: () =>
      api.get('/projects', { params: getProjectParams(filters) }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (project: ProjectItem) => api.delete(`/projects/${project.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      notify.success('Xóa dự án thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa dự án thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <ProjectManager
      projects={projects}
      customers={customers}
      services={services}
      users={users}
      statuses={statuses}
      filters={filters}
      isFetching={isFetching}
      isDeleting={deleteMutation.isPending}
      onFiltersChange={setFilters}
      onDelete={(project) => deleteMutation.mutate(project)}
    />
  );
}
