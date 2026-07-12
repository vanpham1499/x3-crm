'use client';

import { useParams } from 'next/navigation';
import { Alert } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
import { RevenueForm } from '@/features/revenues/components/revenue-form';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { ProjectItem } from '@/types/project';
import type { Revenue } from '@/types/revenue';
import type { ServiceItem } from '@/types/service';

export default function EditRevenuePage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const { data: projects = [] } = useQuery<ProjectItem[]>({
    queryKey: ['projects', 'revenue-form-options'],
    queryFn: () => api.get('/projects').then((response) => response.data),
  });

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'revenue-form-options'],
    queryFn: () =>
      api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: revenue, isLoading } = useQuery<Revenue>({
    queryKey: ['revenues', id],
    queryFn: () => api.get(`/revenues/${id}`).then((response) => response.data),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.put<Revenue>(`/revenues/${id}`, payload).then((response) => response.data),
    onSuccess: (updatedRevenue) => {
      queryClient.setQueryData(['revenues', id], updatedRevenue);
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      notify.success('Cập nhật doanh thu thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật doanh thu thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  if (!revenue) {
    return (
      <div className="p-6">
        <Alert severity="error">Không tìm thấy doanh thu</Alert>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <PageHeader
        title="Chỉnh sửa doanh thu"
        currentLabel={revenue.revenueCode || String(revenue.id)}
      />

      <RevenueForm
        mode="edit"
        revenue={revenue}
        projects={projects}
        services={services}
        isSubmitting={updateMutation.isPending}
        onSubmit={(payload) => updateMutation.mutate(payload)}
      />
    </div>
  );
}
