'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { WeeklyReportForm } from '@/features/weekly-reports/components/weekly-report-form';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { ProjectItem } from '@/types/project';
import type { WeeklyReport } from '@/types/weekly-report';

export default function NewWeeklyReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const projectId = searchParams.get('projectId') || '';
  const weekStart = searchParams.get('weekStart') || '';
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { data: project, isLoading: isProjectLoading } = useQuery<ProjectItem>({
    queryKey: ['projects', 'weekly-report-form', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then((response) => response.data),
    enabled: Boolean(projectId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<WeeklyReport>('/weekly-reports', payload).then((response) => response.data),
    onSuccess: async (report) => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      notify.success('Tạo báo cáo tuần thành công');

      if (pendingFiles.length > 0) {
        const results = await Promise.allSettled(
          pendingFiles.map((file) => {
            const formData = new FormData();
            formData.append('file', file);

            return api.post(`/weekly-reports/${report.id}/attachments`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          }),
        );

        const failed = results.filter((result) => result.status === 'rejected').length;
        if (failed > 0) {
          notify.error(`${failed}/${pendingFiles.length} tệp đính kèm tải lên thất bại`);
        }
      }

      router.push(`/weekly-reports/${report.id}`);
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Tạo báo cáo tuần thất bại')),
  });

  if (projectId && isProjectLoading) {
    return <ContentLoading />;
  }

  return (
    <WeeklyReportForm
      mode="create"
      projects={project ? [project] : []}
      defaultProjectId={projectId}
      defaultWeekStart={weekStart}
      isSubmitting={createMutation.isPending}
      onSubmit={(payload) => createMutation.mutateAsync(payload)}
      pendingFiles={pendingFiles}
      onPendingFilesChange={setPendingFiles}
    />
  );
}
