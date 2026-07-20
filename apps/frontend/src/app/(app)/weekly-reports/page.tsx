'use client';

import { useEffect, useState } from 'react';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { PageHeader } from '@/components/shell/page-header';
import { WeeklyCycleNavigator } from '@/features/weekly-reports/components/weekly-cycle-navigator';
import {
  WeeklyReportBoard,
  WeeklyReportSummary,
} from '@/features/weekly-reports/components/weekly-report-board';
import { WeeklyReportManager } from '@/features/weekly-reports/components/weekly-report-manager';
import { useServerListState } from '@/hooks/use-server-list-state';
import { getApiErrorMessage } from '@/lib/api-error';
import { getCurrentIsoWeekMondayString } from '@/lib/weekly-report-schedule';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { PaginatedResponse } from '@/types/pagination';
import type { ProjectItem } from '@/types/project';
import type { User } from '@/types/user';
import type {
  WeeklyReport,
  WeeklyReportBoardFilters,
  WeeklyReportBoardResponse,
  WeeklyReportFilters,
} from '@/types/weekly-report';

const WEEKLY_REPORTS_PAGE_SIZE = 10;
const WEEKLY_REPORTS_LIST_QUERY_KEY = ['weekly-reports', 'list'] as const;
const WEEKLY_REPORTS_BOARD_QUERY_KEY = ['weekly-reports', 'board'] as const;

const INITIAL_BOARD_FILTERS: WeeklyReportBoardFilters = {
  keyword: '',
  reportOwnerUserId: '',
  reportWeekday: '',
  dueStatus: '',
  progressStatus: '',
  weeklyCondition: '',
};

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
  const [activeTab, setActiveTab] = useState(0);
  const [selectedWeekStart, setSelectedWeekStart] = useState(getCurrentIsoWeekMondayString());
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(WEEKLY_REPORTS_PAGE_SIZE);
  const [historyFilters, setHistoryFilters] = useState<WeeklyReportFilters>({
    projectId: '',
    status: '',
  });
  const boardState = useServerListState<WeeklyReportBoardFilters>({
    initialFilters: INITIAL_BOARD_FILTERS,
    queryKey: WEEKLY_REPORTS_BOARD_QUERY_KEY,
    pageSize: WEEKLY_REPORTS_PAGE_SIZE,
  });

  const { data: projects = [] } = useQuery<ProjectItem[]>({
    queryKey: ['projects', 'weekly-report-options'],
    queryFn: () => api.get('/projects').then((response) => response.data),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'weekly-report-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: boardResponse, isFetching: isBoardFetching } = useQuery<WeeklyReportBoardResponse>({
    queryKey: [
      ...WEEKLY_REPORTS_BOARD_QUERY_KEY,
      selectedWeekStart,
      boardState.requestFilters,
      boardState.page,
      boardState.pageSize,
    ],
    queryFn: ({ signal }) =>
      api
        .get<WeeklyReportBoardResponse>('/weekly-reports/board', {
          params: {
            week_start: selectedWeekStart,
            keyword: boardState.requestFilters.keyword || undefined,
            report_owner_user_id: boardState.requestFilters.reportOwnerUserId || undefined,
            report_weekday: boardState.requestFilters.reportWeekday || undefined,
            due_status: boardState.requestFilters.dueStatus || undefined,
            progress_status: boardState.requestFilters.progressStatus || undefined,
            weekly_condition: boardState.requestFilters.weeklyCondition || undefined,
            page: boardState.page,
            per_page: boardState.pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const { data: reportsPage, isFetching: isHistoryFetching } = useQuery<
    PaginatedResponse<WeeklyReport>
  >({
    queryKey: [...WEEKLY_REPORTS_LIST_QUERY_KEY, historyFilters, historyPage, historyPageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<WeeklyReport>>('/weekly-reports', {
          params: {
            ...reportParams(historyFilters),
            page: historyPage,
            per_page: historyPageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
    enabled: activeTab === 1,
  });

  const boardMeta = boardResponse?.meta || {
    currentPage: boardState.page,
    lastPage: 1,
    perPage: boardState.pageSize,
    total: 0,
    from: null,
    to: null,
    weekStart: selectedWeekStart,
    weekEnd: selectedWeekStart,
    summary: { total: 0, dueToday: 0, overdue: 0, waitingApproval: 0, completed: 0 },
  };
  const historyMeta = reportsPage?.meta || {
    currentPage: historyPage,
    lastPage: 1,
    perPage: historyPageSize,
    total: 0,
    from: null,
    to: null,
  };

  useEffect(() => {
    if (boardState.page > boardMeta.lastPage) {
      boardState.setPage(Math.max(1, boardMeta.lastPage));
    }
  }, [boardMeta.lastPage, boardState]);

  useEffect(() => {
    if (historyPage > historyMeta.lastPage) {
      setHistoryPage(Math.max(1, historyMeta.lastPage));
    }
  }, [historyMeta.lastPage, historyPage]);

  const refreshReports = () => {
    queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (report: WeeklyReport) => api.delete(`/weekly-reports/${report.id}`),
    onSuccess: () => {
      refreshReports();
      notify.success('Xóa báo cáo tuần thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Xóa báo cáo tuần thất bại')),
  });

  const submitMutation = useMutation({
    mutationFn: (report: WeeklyReport) => api.post(`/weekly-reports/${report.id}/submit`),
    onSuccess: () => {
      refreshReports();
      notify.success('Đã gửi báo cáo để duyệt');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Gửi báo cáo thất bại')),
  });

  const approveMutation = useMutation({
    mutationFn: (report: WeeklyReport) => api.post(`/weekly-reports/${report.id}/approve`),
    onSuccess: () => {
      refreshReports();
      notify.success('Đã duyệt báo cáo tuần');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Duyệt báo cáo thất bại')),
  });

  const returnMutation = useMutation({
    mutationFn: (report: WeeklyReport) => api.post(`/weekly-reports/${report.id}/return-to-draft`),
    onSuccess: () => {
      refreshReports();
      notify.success('Đã trả báo cáo về nháp');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Trả báo cáo về nháp thất bại')),
  });

  const commonActionProps = {
    isDeleting: deleteMutation.isPending,
    isSubmitting: submitMutation.isPending,
    isApproving: approveMutation.isPending,
    isReturning: returnMutation.isPending,
    currentUser,
    onDelete: (report: WeeklyReport) => deleteMutation.mutate(report),
    onSubmit: (report: WeeklyReport) => submitMutation.mutate(report),
    onApprove: (report: WeeklyReport) => approveMutation.mutate(report),
    onReturnToDraft: (report: WeeklyReport) => returnMutation.mutate(report),
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader title="Báo cáo tuần" />

      <WeeklyReportSummary
        filters={boardState.filters}
        summary={boardMeta.summary}
        onFiltersChange={(filters) => {
          setActiveTab(0);
          boardState.onFiltersChange(filters);
        }}
      />

      <div className="mb-4 flex items-center justify-between gap-4 overflow-x-auto rounded-xl border border-slate-200 bg-white pr-3 shadow-sm no-border-tabs">
        <div className="min-w-max flex-1">
          <IconTabs
            value={activeTab}
            ariaLabel="Điều hướng báo cáo tuần"
            items={[
              { label: 'Theo dõi tuần', icon: <DashboardCustomizeOutlinedIcon /> },
              { label: 'Lịch sử báo cáo', icon: <HistoryRoundedIcon /> },
            ]}
            onChange={setActiveTab}
          />
        </div>
        <div className="shrink-0 py-1.5">
          <WeeklyCycleNavigator
            weekStart={selectedWeekStart}
            maxWeekStart={getCurrentIsoWeekMondayString()}
            onChange={(weekStart) => {
              void queryClient.cancelQueries({ queryKey: WEEKLY_REPORTS_BOARD_QUERY_KEY });
              setActiveTab(0);
              boardState.setPage(1);
              setSelectedWeekStart(weekStart);
            }}
          />
        </div>
      </div>

      {activeTab === 0 ? (
        <WeeklyReportBoard
          rows={boardResponse?.data || []}
          users={users}
          filters={boardState.filters}
          weekStart={selectedWeekStart}
          isFetching={isBoardFetching}
          page={boardMeta.currentPage}
          totalPages={boardMeta.lastPage}
          totalItems={boardMeta.total}
          pageSize={boardState.pageSize}
          onPageChange={boardState.setPage}
          onPageSizeChange={boardState.setPageSize}
          onFiltersChange={boardState.onFiltersChange}
          {...commonActionProps}
        />
      ) : (
        <WeeklyReportManager
          reports={reportsPage?.data || []}
          projects={projects}
          filters={historyFilters}
          isFetching={isHistoryFetching}
          page={historyMeta.currentPage}
          totalPages={historyMeta.lastPage}
          totalItems={historyMeta.total}
          pageSize={historyPageSize}
          onPageChange={setHistoryPage}
          onPageSizeChange={(pageSize) => {
            void queryClient.cancelQueries({ queryKey: WEEKLY_REPORTS_LIST_QUERY_KEY });
            setHistoryPage(1);
            setHistoryPageSize(pageSize);
          }}
          onFiltersChange={(filters) => {
            setHistoryPage(1);
            setHistoryFilters(filters);
          }}
          {...commonActionProps}
        />
      )}
    </div>
  );
}
