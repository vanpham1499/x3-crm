'use client';

import { useState } from 'react';
import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { KpiManager } from '@/features/kpi/components/kpi-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { hasPermission } from '@/lib/ownership';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { KpiPeriodFilters, KpiReport, KpiTargetPayload } from '@/types/kpi';

function currentPeriod() {
  const today = new Date();

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function currentQuarter() {
  return String(Math.floor(new Date().getMonth() / 3) + 1);
}

function monthValue(year: string, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function resolvePeriodRange(filters: KpiPeriodFilters) {
  if (filters.mode === 'quarter') {
    const quarter = Math.min(4, Math.max(1, Number(filters.quarter) || 1));
    const firstMonth = (quarter - 1) * 3 + 1;

    return {
      periodFrom: monthValue(filters.year, firstMonth),
      periodTo: monthValue(filters.year, firstMonth + 2),
    };
  }

  if (filters.mode === 'year') {
    return {
      periodFrom: monthValue(filters.year, 1),
      periodTo: monthValue(filters.year, 12),
    };
  }

  if (filters.mode === 'range') {
    return {
      periodFrom: filters.periodFrom,
      periodTo: filters.periodTo,
    };
  }

  return {
    periodFrom: filters.month,
    periodTo: filters.month,
  };
}

export default function KpiPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const initialMonth = currentPeriod();
  const [filters, setFilters] = useState<KpiPeriodFilters>({
    mode: 'month',
    month: initialMonth,
    quarter: currentQuarter(),
    year: initialMonth.slice(0, 4),
    periodFrom: initialMonth,
    periodTo: initialMonth,
  });
  const range = useMemo(() => resolvePeriodRange(filters), [filters]);

  const {
    data: report,
    isLoading,
    isFetching,
  } = useQuery<KpiReport>({
    queryKey: ['kpi', range.periodFrom, range.periodTo],
    queryFn: ({ signal }) =>
      api
        .get<KpiReport>('/kpi', {
          params: {
            period_from: range.periodFrom,
            period_to: range.periodTo,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const targetMutation = useMutation({
    mutationFn: (payload: KpiTargetPayload) => api.put('/kpi/targets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi'] });
      notify.success('Đã cập nhật kế hoạch KPI');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể cập nhật kế hoạch KPI')),
  });

  if (isLoading || !report) {
    return <ContentLoading />;
  }

  return (
    <KpiManager
      report={report}
      filters={filters}
      canManage={
        hasPermission(currentUser, 'kpi.manage') ||
        hasPermission(currentUser, 'kpi.manage_department') ||
        hasPermission(currentUser, 'kpi.manage_all')
      }
      isFetching={isFetching}
      isSaving={targetMutation.isPending}
      onFiltersChange={setFilters}
      onSaveTarget={(payload) => targetMutation.mutateAsync(payload)}
    />
  );
}
