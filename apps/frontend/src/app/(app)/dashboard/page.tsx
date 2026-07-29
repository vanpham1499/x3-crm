'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/feedback/error-state';
import { ContentLoading } from '@/components/shell/content-loading';
import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DashboardPeriodFilters, DashboardReport } from '@/types/dashboard';

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

function resolvePeriodRange(filters: DashboardPeriodFilters) {
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

export default function DashboardPage() {
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const initialMonth = currentPeriod();
  const [filters, setFilters] = useState<DashboardPeriodFilters>({
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
    isError,
    refetch,
  } = useQuery<DashboardReport>({
    queryKey: ['dashboard', currentUserId, range.periodFrom, range.periodTo],
    queryFn: ({ signal }) =>
      api
        .get<DashboardReport>('/dashboard', {
          params: {
            period_from: range.periodFrom,
            period_to: range.periodTo,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  if (isError) {
    return (
      <ErrorState
        compact
        code="DASHBOARD"
        title="Chưa tải được Dashboard"
        description="Không thể tổng hợp dữ liệu ở thời điểm hiện tại. Vui lòng thử tải lại."
        secondaryHref="/profile"
        secondaryLabel="Về hồ sơ"
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || !report) {
    return <ContentLoading />;
  }

  return (
    <DashboardOverview
      report={report}
      filters={filters}
      isFetching={isFetching}
      onFiltersChange={setFilters}
    />
  );
}
