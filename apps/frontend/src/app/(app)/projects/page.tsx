'use client';

import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { ProjectManager } from '@/features/projects/components/project-manager';
import { useServerListState } from '@/hooks/use-server-list-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { DEFAULT_PROJECT_FILTERS } from '@/lib/project-utils';
import { SERVICE_QUOTE_CONFIG_GROUP } from '@/lib/service-quote-config';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { AppOption } from '@/types/option';
import type { PaginatedResponse } from '@/types/pagination';
import type { ProjectFilters, ProjectItem } from '@/types/project';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

const PROJECTS_PAGE_SIZE = 10;
const PROJECTS_LIST_QUERY_KEY = ['projects', 'list'] as const;

function getProjectParams(filters: ProjectFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    service_id: filters.service_id || undefined,
    status_option_id: filters.status_option_id || undefined,
    manager_user_id: filters.manager_user_id || undefined,
    sales_user_id: filters.sales_user_id || undefined,
  };
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const { filters, requestFilters, page, pageSize, setPage, setPageSize, onFiltersChange } =
    useServerListState<ProjectFilters>({
      initialFilters: DEFAULT_PROJECT_FILTERS,
      queryKey: PROJECTS_LIST_QUERY_KEY,
      pageSize: PROJECTS_PAGE_SIZE,
    });

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'project-options'],
    queryFn: () =>
      api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'project-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: statuses = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'project_status'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'project_status' } })
        .then((response) => response.data),
  });

  const { data: quoteConfigs = [] } = useQuery<AppOption[]>({
    queryKey: ['options', SERVICE_QUOTE_CONFIG_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SERVICE_QUOTE_CONFIG_GROUP } })
        .then((response) => response.data),
  });

  const {
    data: projectsPage,
    isFetching,
    isLoading,
  } = useQuery<PaginatedResponse<ProjectItem>>({
    queryKey: [...PROJECTS_LIST_QUERY_KEY, requestFilters, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<ProjectItem>>('/projects', {
          params: {
            ...getProjectParams(requestFilters),
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const projects = projectsPage?.data || [];
  const pagination = projectsPage?.meta || {
    currentPage: page,
    lastPage: 1,
    perPage: pageSize,
    total: 0,
    from: null,
    to: null,
  };

  useEffect(() => {
    if (page > pagination.lastPage) {
      setPage(Math.max(1, pagination.lastPage));
    }
  }, [page, pagination.lastPage]);

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
      services={services}
      users={users}
      statuses={statuses}
      quoteConfigs={quoteConfigs}
      filters={filters}
      page={page}
      totalPages={pagination.lastPage}
      totalItems={pagination.total}
      pageSize={pageSize}
      isFetching={isFetching}
      isDeleting={deleteMutation.isPending}
      currentUser={currentUser}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onFiltersChange={onFiltersChange}
      onDelete={(project) => deleteMutation.mutate(project)}
    />
  );
}
