'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
import { RevenueForm } from '@/features/revenues/components/revenue-form';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { ProjectItem } from '@/types/project';
import type { Revenue, RevenueFormValues } from '@/types/revenue';
import type { ServiceItem } from '@/types/service';

export default function NewRevenuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const projectId = searchParams.get('projectId') || '';

  const { data: projects = [], isLoading: isProjectsLoading } = useQuery<ProjectItem[]>({
    queryKey: ['projects', 'revenue-form-options'],
    queryFn: () => api.get('/projects').then((response) => response.data),
  });

  const { data: services = [], isLoading: isServicesLoading } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'revenue-form-options'],
    queryFn: () =>
      api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const defaultValues: Partial<RevenueFormValues> = { projectId };

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<Revenue>('/revenues', payload).then((response) => response.data),
    onSuccess: (revenue) => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      notify.success('Ghi nhận doanh thu thành công');
      router.push(`/revenues/${revenue.id}`);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Ghi nhận doanh thu thất bại'));
    },
  });

  if (isProjectsLoading || isServicesLoading) {
    return <ContentLoading />;
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <PageHeader title="Ghi nhận doanh thu" />

      <RevenueForm
        mode="create"
        projects={projects}
        services={services}
        defaultValues={defaultValues}
        isSubmitting={createMutation.isPending}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />
    </div>
  );
}
