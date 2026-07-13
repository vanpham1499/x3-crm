'use client';

import { useParams } from 'next/navigation';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { Alert, Button } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { WeeklyReportForm } from '@/features/weekly-reports/components/weekly-report-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api/client';
import type { ProjectItem } from '@/types/project';
import type { User } from '@/types/user';
import type { WeeklyReport } from '@/types/weekly-report';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Đã gửi',
  approved: 'Đã duyệt',
};

export default function EditWeeklyReportPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const canApprove = currentUser?.role === 'ADMIN' || currentUser?.role === 'LEADER';

  const { data: projects = [], isLoading: isProjectsLoading } = useQuery<ProjectItem[]>({
    queryKey: ['projects', 'weekly-report-form-options'],
    queryFn: () => api.get('/projects').then((response) => response.data),
  });

  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['users', 'weekly-report-form-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: report, isLoading: isReportLoading } = useQuery<WeeklyReport>({
    queryKey: ['weekly-reports', id],
    queryFn: () => api.get(`/weekly-reports/${id}`).then((response) => response.data),
    enabled: Boolean(id),
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

  if (isProjectsLoading || isUsersLoading || isReportLoading) {
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
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2 px-6 pt-6">
        <span className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
          Trạng thái: {STATUS_LABELS[report.status] || report.status}
        </span>
        {report.status === 'draft' && (
          <Button
            variant="outlined"
            startIcon={<SendRoundedIcon />}
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? 'Đang gửi...' : 'Gửi duyệt'}
          </Button>
        )}
        {report.status === 'submitted' && canApprove && (
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleOutlineRoundedIcon />}
            disabled={approveMutation.isPending}
            onClick={() => approveMutation.mutate()}
          >
            {approveMutation.isPending ? 'Đang duyệt...' : 'Duyệt báo cáo'}
          </Button>
        )}
      </div>

      <WeeklyReportForm
        mode="edit"
        report={report}
        projects={projects}
        users={users}
        isSubmitting={updateMutation.isPending}
        onSubmit={(payload) => updateMutation.mutateAsync(payload)}
      />
    </div>
  );
}
