'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { P2Manager } from '@/features/p2/components/p2-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { PaginatedResponse, PaginationMeta } from '@/types/pagination';
import type { User } from '@/types/user';
import {
  P2_CATEGORY_OPTION_GROUP,
  p2CategoryFromOption,
  type P2Point,
  type P2PointFilters,
  type P2PointFormValues,
  type P2PointOverview,
  type P2PointSummary,
} from '@/types/p2';

const P2_PAGE_SIZE = 10;
const P2_LIST_QUERY_KEY = ['p2-points', 'list'] as const;

type P2PointsPageResponse = PaginatedResponse<P2Point> & {
  meta: PaginationMeta & {
    summary?: P2PointSummary[];
    overview?: P2PointOverview;
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

function p2Params(filters: P2PointFilters) {
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

export default function P2PointsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(P2_PAGE_SIZE);
  const [filters, setFilters] = useState<P2PointFilters>({
    userId: '',
    category: '',
    type: '',
    approvalStatus: '',
    dateFrom: initialMonthStart,
    dateTo: initialDate,
  });

  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['users', 'p2-options'],
    queryFn: () => api.get('/users/lookup?context=p2point').then((response) => response.data),
  });

  const { data: categoryOptions = [], isLoading: isCategoriesLoading } = useQuery<AppOption[]>({
    queryKey: ['options', P2_CATEGORY_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: P2_CATEGORY_OPTION_GROUP } })
        .then((response) => response.data),
  });
  const categories = categoryOptions
    .filter((option) => option.isActive !== false)
    .map(p2CategoryFromOption);

  const {
    data: pointsPage,
    isFetching,
    isLoading,
  } = useQuery<P2PointsPageResponse>({
    queryKey: [...P2_LIST_QUERY_KEY, filters, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<P2PointsPageResponse>('/p2-points', {
          params: {
            ...p2Params(filters),
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
    void queryClient.cancelQueries({ queryKey: P2_LIST_QUERY_KEY });
    setPage(1);
    setPageSize(nextPageSize);
  };

  const saveMutation = useMutation({
    mutationFn: (values: P2PointFormValues) =>
      api.post<P2Point>('/p2-points', {
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
      queryClient.invalidateQueries({ queryKey: ['p2-points'] });
      notify.success('Đã ghi nhận điểm P2');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể lưu điểm P2')),
  });

  const deleteMutation = useMutation({
    mutationFn: (point: P2Point) => api.delete(`/p2-points/${point.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['p2-points'] });
      notify.success('Đã xóa điểm P2');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể xóa điểm P2')),
  });

  const approveMutation = useMutation({
    mutationFn: (point: P2Point) => api.post(`/p2-points/${point.id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['p2-points'] });
      notify.success('Đã duyệt điểm P2');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Duyệt điểm P2 thất bại')),
  });

  if (isLoading || isUsersLoading || isCategoriesLoading) {
    return <ContentLoading />;
  }

  return (
    <P2Manager
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
