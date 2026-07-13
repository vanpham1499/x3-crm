'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { KpiManager } from '@/features/kpi/components/kpi-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';
import {
  KPI_CATEGORY_OPTION_GROUP,
  kpiCategoryFromOption,
  type KpiPoint,
  type KpiPointFilters,
  type KpiPointFormValues,
} from '@/types/kpi';

function kpiParams(filters: KpiPointFilters) {
  return {
    user_id: filters.userId || undefined,
    category: filters.category || undefined,
    type: filters.type || undefined,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
  };
}

export default function KpiPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const canApprove = currentUser?.role === 'ADMIN' || currentUser?.role === 'LEADER';
  const [filters, setFilters] = useState<KpiPointFilters>({
    userId: '',
    category: '',
    type: '',
    dateFrom: '',
    dateTo: '',
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
    data: points = [],
    isFetching,
    isLoading,
  } = useQuery<KpiPoint[]>({
    queryKey: ['kpi-points', filters],
    queryFn: () =>
      api.get<KpiPoint[]>('/kpi-points', { params: kpiParams(filters) }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const saveMutation = useMutation({
    mutationFn: (values: KpiPointFormValues) =>
      api.post<KpiPoint>('/kpi-points', {
        userId: Number(values.userId),
        user_id: Number(values.userId),
        entryDate: values.entryDate,
        entry_date: values.entryDate,
        category: values.category,
        score: Number(values.score) || 0,
        customerRef: values.customerRef.trim() || null,
        customer_ref: values.customerRef.trim() || null,
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
      users={users}
      categories={categories}
      filters={filters}
      isFetching={isFetching}
      isSaving={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      isApproving={approveMutation.isPending}
      canApprove={canApprove}
      onFiltersChange={setFilters}
      onSave={(values) => saveMutation.mutateAsync(values)}
      onDelete={(point) => deleteMutation.mutate(point)}
      onApprove={(point) => approveMutation.mutate(point)}
    />
  );
}
