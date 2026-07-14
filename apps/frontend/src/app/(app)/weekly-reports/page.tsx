'use client';

import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { WeeklyReportManager } from '@/features/weekly-reports/components/weekly-report-manager';
import { WeeklySettingsDialog } from '@/features/weekly-reports/components/weekly-settings-dialog';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  getCurrentIsoWeekMondayString,
  getCurrentIsoWeekSundayString,
  getIsoWeekday,
} from '@/lib/weekly-report-schedule';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api/client';
import type { ProjectItem } from '@/types/project';
import type { PaginatedResponse } from '@/types/pagination';
import type { User } from '@/types/user';
import type {
  ProjectWeeklySetting,
  ProjectWeeklySettingFormValues,
  WeeklyReport,
  WeeklyReportFilters,
} from '@/types/weekly-report';

const WEEKLY_REPORTS_PAGE_SIZE = 10;
const WEEKLY_REPORTS_LIST_QUERY_KEY = ['weekly-reports', 'list'] as const;

function reportParams(filters: WeeklyReportFilters) {
  return {
    project_id: filters.projectId || undefined,
    status: filters.status || undefined,
  };
}

export default function WeeklyReportsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const canApprove = currentUser?.role === 'ADMIN' || currentUser?.role === 'LEADER';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(WEEKLY_REPORTS_PAGE_SIZE);
  const [filters, setFilters] = useState<WeeklyReportFilters>({ projectId: '', status: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: projects = [] } = useQuery<ProjectItem[]>({
    queryKey: ['projects', 'weekly-report-options'],
    queryFn: () => api.get('/projects').then((response) => response.data),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'weekly-report-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const {
    data: reportsPage,
    isFetching,
    isLoading,
  } = useQuery<PaginatedResponse<WeeklyReport>>({
    queryKey: [...WEEKLY_REPORTS_LIST_QUERY_KEY, filters, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<WeeklyReport>>('/weekly-reports', {
          params: {
            ...reportParams(filters),
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const reports = reportsPage?.data || [];
  const pagination = reportsPage?.meta || {
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

  const handlePageSizeChange = (nextPageSize: number) => {
    void queryClient.cancelQueries({ queryKey: WEEKLY_REPORTS_LIST_QUERY_KEY });
    setPage(1);
    setPageSize(nextPageSize);
  };

  const { data: projectSettings } = useQuery<ProjectWeeklySetting[]>({
    queryKey: ['project-weekly-settings', filters.projectId],
    queryFn: () =>
      api
        .get<ProjectWeeklySetting[]>('/project-weekly-settings', {
          params: { project_id: filters.projectId },
        })
        .then((response) => response.data),
    enabled: Boolean(filters.projectId) && settingsOpen,
  });

  const currentWeekMonday = getCurrentIsoWeekMondayString();
  const currentWeekSunday = getCurrentIsoWeekSundayString();
  const todayIsoWeekday = getIsoWeekday(new Date());

  const { data: activeSettings = [], isLoading: isActiveSettingsLoading } = useQuery<
    ProjectWeeklySetting[]
  >({
    queryKey: ['project-weekly-settings', 'active'],
    queryFn: () =>
      api
        .get<ProjectWeeklySetting[]>('/project-weekly-settings', { params: { is_active: 1 } })
        .then((response) => response.data),
  });

  const { data: allReports = [], isLoading: isAllReportsLoading } = useQuery<WeeklyReport[]>({
    queryKey: ['weekly-reports', 'all-for-overdue-check'],
    queryFn: () => api.get<WeeklyReport[]>('/weekly-reports').then((response) => response.data),
  });

  // Wait for both datasets before computing, so the banner doesn't briefly
  // flash a false-positive list while only one of the two queries has resolved.
  const isOverdueDataReady = !isActiveSettingsLoading && !isAllReportsLoading;

  const overdueSettings = useMemo(() => {
    if (!isOverdueDataReady) return [];

    const reportedProjectIds = new Set(
      allReports
        .filter(
          (report) =>
            report.weekStartDate <= currentWeekSunday && report.weekEndDate >= currentWeekMonday,
        )
        .map((report) => report.projectId),
    );

    return activeSettings.filter(
      (setting) =>
        setting.reportWeekday &&
        todayIsoWeekday >= setting.reportWeekday &&
        !reportedProjectIds.has(setting.projectId),
    );
  }, [
    isOverdueDataReady,
    activeSettings,
    allReports,
    currentWeekMonday,
    currentWeekSunday,
    todayIsoWeekday,
  ]);

  const deleteMutation = useMutation({
    mutationFn: (report: WeeklyReport) => api.delete(`/weekly-reports/${report.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      notify.success('Xóa báo cáo tuần thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Xóa báo cáo tuần thất bại')),
  });

  const submitMutation = useMutation({
    mutationFn: (report: WeeklyReport) => api.post(`/weekly-reports/${report.id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      notify.success('Đã gửi báo cáo để duyệt');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Gửi báo cáo thất bại')),
  });

  const approveMutation = useMutation({
    mutationFn: (report: WeeklyReport) => api.post(`/weekly-reports/${report.id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      notify.success('Đã duyệt báo cáo tuần');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Duyệt báo cáo thất bại')),
  });

  const settingsMutation = useMutation({
    mutationFn: (values: ProjectWeeklySettingFormValues) =>
      api.post<ProjectWeeklySetting>('/project-weekly-settings', {
        projectId: Number(filters.projectId),
        project_id: Number(filters.projectId),
        reportOwnerUserId: values.reportOwnerUserId ? Number(values.reportOwnerUserId) : null,
        report_owner_user_id: values.reportOwnerUserId ? Number(values.reportOwnerUserId) : null,
        reportWeekday: Number(values.reportWeekday),
        report_weekday: Number(values.reportWeekday),
        monthlyBudget: Number(values.monthlyBudget) || 0,
        monthly_budget: Number(values.monthlyBudget) || 0,
        managementFeeRate: Number(values.managementFeeRate) || 0,
        management_fee_rate: Number(values.managementFeeRate) || 0,
        isActive: values.isActive,
        is_active: values.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-weekly-settings'] });
      notify.success('Đã lưu cấu hình báo cáo tuần');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Lưu cấu hình thất bại')),
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <>
      <WeeklyReportManager
        reports={reports}
        projects={projects}
        overdueSettings={overdueSettings}
        filters={filters}
        isFetching={isFetching}
        isDeleting={deleteMutation.isPending}
        isSubmitting={submitMutation.isPending}
        isApproving={approveMutation.isPending}
        canApprove={canApprove}
        page={page}
        totalPages={pagination.lastPage}
        totalItems={pagination.total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
        onFiltersChange={(nextFilters) => {
          setPage(1);
          setFilters(nextFilters);
        }}
        onDelete={(report) => deleteMutation.mutate(report)}
        onSubmit={(report) => submitMutation.mutate(report)}
        onApprove={(report) => approveMutation.mutate(report)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <WeeklySettingsDialog
        open={settingsOpen}
        setting={projectSettings?.[0]}
        users={users}
        isSubmitting={settingsMutation.isPending}
        onClose={() => setSettingsOpen(false)}
        onSubmit={(values) => settingsMutation.mutateAsync(values)}
      />
    </>
  );
}
