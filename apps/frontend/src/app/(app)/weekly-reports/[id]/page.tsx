'use client';

import { useParams } from 'next/navigation';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { Alert } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { WeeklyReportForm } from '@/features/weekly-reports/components/weekly-report-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api/client';
import type { ProjectItem } from '@/types/project';
import type { WeeklyReport } from '@/types/weekly-report';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
};

export default function EditWeeklyReportPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const canApprove = currentUser?.role === 'ADMIN' || currentUser?.role === 'LEADER';

  const { data: report, isLoading: isReportLoading } = useQuery<WeeklyReport>({
    queryKey: ['weekly-reports', id],
    queryFn: () => api.get(`/weekly-reports/${id}`).then((response) => response.data),
    enabled: Boolean(id),
  });

  const { data: project, isLoading: isProjectLoading } = useQuery<ProjectItem>({
    queryKey: ['projects', 'weekly-report-form', report?.projectId],
    queryFn: () => api.get(`/projects/${report?.projectId}`).then((response) => response.data),
    enabled: Boolean(report?.projectId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.put<WeeklyReport>(`/weekly-reports/${id}`, payload).then((response) => response.data),
    onSuccess: (updatedReport) => {
      queryClient.setQueryData(['weekly-reports', id], updatedReport);
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      notify.success('Cập nhật báo cáo tuần thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Cập nhật báo cáo tuần thất bại')),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post<WeeklyReport>(`/weekly-reports/${id}/submit`).then((r) => r.data),
    onSuccess: (updatedReport) => {
      queryClient.setQueryData(['weekly-reports', id], updatedReport);
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      notify.success('Đã gửi báo cáo để duyệt');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Gửi báo cáo thất bại')),
  });

  const approveMutation = useMutation({
    mutationFn: () => api.post<WeeklyReport>(`/weekly-reports/${id}/approve`).then((r) => r.data),
    onSuccess: (updatedReport) => {
      queryClient.setQueryData(['weekly-reports', id], updatedReport);
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      notify.success('Đã duyệt báo cáo tuần');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Duyệt báo cáo thất bại')),
  });

  const returnMutation = useMutation({
    mutationFn: () =>
      api.post<WeeklyReport>(`/weekly-reports/${id}/return-to-draft`).then((r) => r.data),
    onSuccess: (updatedReport) => {
      queryClient.setQueryData(['weekly-reports', id], updatedReport);
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      notify.success('Đã trả báo cáo về nháp');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Trả báo cáo về nháp thất bại')),
  });

  if (isReportLoading || (report?.projectId && isProjectLoading)) {
    return <ContentLoading />;
  }

  if (!report) {
    return (
      <div className="p-6">
        <Alert severity="error">Không tìm thấy báo cáo tuần</Alert>
      </div>
    );
  }

  return (
    <WeeklyReportForm
      mode="edit"
      report={report}
      projects={project ? [project] : []}
      isSubmitting={updateMutation.isPending}
      onSubmit={(payload) => updateMutation.mutateAsync(payload)}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
            {STATUS_LABELS[report.status] || report.status}
          </span>
          {report.status === 'draft' && (
            <PrimaryActionButton
              tone="secondary"
              startIcon={<SendRoundedIcon />}
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? 'Đang gửi...' : 'Gửi duyệt'}
            </PrimaryActionButton>
          )}
          {report.status === 'submitted' && canApprove && (
            <>
              <PrimaryActionButton
                tone="secondary"
                startIcon={<ReplayRoundedIcon />}
                disabled={returnMutation.isPending}
                onClick={() => returnMutation.mutate()}
              >
                {returnMutation.isPending ? 'Đang trả về...' : 'Trả về nháp'}
              </PrimaryActionButton>
              <PrimaryActionButton
                startIcon={<CheckCircleOutlineRoundedIcon />}
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                {approveMutation.isPending ? 'Đang duyệt...' : 'Duyệt báo cáo'}
              </PrimaryActionButton>
            </>
          )}
        </div>
      }
    />
  );
}
