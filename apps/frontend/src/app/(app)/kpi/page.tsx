'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { KpiManager } from '@/features/kpi/components/kpi-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { PaginatedResponse, PaginationMeta } from '@/types/pagination';
import type { User } from '@/types/user';
import {
  KPI_CATEGORY_OPTION_GROUP,
  kpiCategoryFromOption,
  type KpiPoint,
  type KpiPointFilters,
  type KpiPointFormValues,
  type KpiPointOverview,
  type KpiPointSummary,
} from '@/types/kpi';

const KPI_PAGE_SIZE = 10;
const KPI_LIST_QUERY_KEY = ['kpi-points', 'list'] as const;

type KpiPointsPage = PaginatedResponse<KpiPoint> & {
  meta: PaginationMeta & {
    summary?: KpiPointSummary[];
    overview?: KpiPointOverview;
  };
};

function getCurrentDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
}

const initialDate = getCurrentDate();
const initialMonthStart = `${initialDate.slice(0, 7)}-01`;

function kpiParams(filters: KpiPointFilters) {
  return {
    user_id: filters.userId || undefined,
    category: filters.category || undefined,
    type: filters.type || undefined,
    is_approved:
      filters.approvalStatus === 'approved'
        ? 1
        : filters.approvalStatus === 'pending'
          ? 0
          : undefined,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
  };
}

export default function KpiPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(KPI_PAGE_SIZE);
  const [filters, setFilters] = useState<KpiPointFilters>({
    userId: '',
    category: '',
    type: '',
    approvalStatus: '',
    dateFrom: initialMonthStart,
    dateTo: initialDate,
  });

  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['users', 'kpi-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: categoryOptions = [], isLoading: isCategoriesLoading } = useQuery<AppOption[]>({
    queryKey: ['options', KPI_CATEGORY_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: KPI_CATEGORY_OPTION_GROUP } })
        .then((response) => response.data),
  });
  const categories = categoryOptions
    .filter((option) => option.isActive !== false)
    .map(kpiCategoryFromOption);

  const {
    data: pointsPage,
    isFetching,
    isLoading,
  } = useQuery<KpiPointsPage>({
    queryKey: [...KPI_LIST_QUERY_KEY, filters, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<KpiPointsPage>('/kpi-points', {
          params: {
            ...kpiParams(filters),
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const points = pointsPage?.data || [];
  const pagination = pointsPage?.meta || {
    currentPage: page,
    lastPage: 1,
    perPage: pageSize,
    total: 0,
    from: null,
    to: null,
    summary: [],
    overview: undefined,
  };

  useEffect(() => {
    if (page > pagination.lastPage) {
      setPage(Math.max(1, pagination.lastPage));
    }
  }, [page, pagination.lastPage]);

  const handlePageSizeChange = (nextPageSize: number) => {
    void queryClient.cancelQueries({ queryKey: KPI_LIST_QUERY_KEY });
    setPage(1);
    setPageSize(nextPageSize);
  };

  const saveMutation = useMutation({
    mutationFn: (values: KpiPointFormValues) =>
      api.post<KpiPoint>('/kpi-points', {
        userId: Number(values.userId),
        user_id: Number(values.userId),
        projectId: values.projectId ? Number(values.projectId) : null,
        project_id: values.projectId ? Number(values.projectId) : null,
        entryDate: values.entryDate,
        entry_date: values.entryDate,
        category: values.category,
        score: Number(values.score) || 0,
        note: values.note.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-points'] });
      notify.success('Đã ghi nhận điểm KPI');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể lưu điểm KPI')),
  });

  const deleteMutation = useMutation({
    mutationFn: (point: KpiPoint) => api.delete(`/kpi-points/${point.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-points'] });
      notify.success('Đã xóa điểm KPI');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể xóa điểm KPI')),
  });

  const approveMutation = useMutation({
    mutationFn: (point: KpiPoint) => api.post(`/kpi-points/${point.id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-points'] });
      notify.success('Đã duyệt điểm KPI');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Duyệt điểm KPI thất bại')),
  });

  if (isLoading || isUsersLoading || isCategoriesLoading) {
    return <ContentLoading />;
  }

  return (
    <KpiManager
      points={points}
      summary={pagination.summary || []}
      overview={
        pagination.overview || {
          bonusScore: 0,
          penaltyScore: 0,
          netScore: 0,
          pendingCount: 0,
        }
      }
      users={users}
      categories={categories}
      filters={filters}
      isFetching={isFetching}
      isSaving={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      isApproving={approveMutation.isPending}
      currentUser={currentUser}
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
      onSave={(values) => saveMutation.mutateAsync(values)}
      onDelete={(point) => deleteMutation.mutate(point)}
      onApprove={(point) => approveMutation.mutate(point)}
    />
  );
}
