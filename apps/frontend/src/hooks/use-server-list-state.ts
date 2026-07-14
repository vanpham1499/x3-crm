'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

type ServerListFilters = {
  keyword: string;
};

type UseServerListStateOptions<TFilters extends ServerListFilters> = {
  initialFilters: TFilters;
  queryKey: QueryKey;
  pageSize?: number;
  searchDelay?: number;
};

export function useServerListState<TFilters extends ServerListFilters>({
  initialFilters,
  queryKey,
  pageSize: initialPageSize = 10,
  searchDelay = 300,
}: UseServerListStateOptions<TFilters>) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [filters, setFilters] = useState<TFilters>(() => initialFilters);
  const [debouncedKeyword, setDebouncedKeyword] = useState(initialFilters.keyword);

  useEffect(() => {
    if (filters.keyword === debouncedKeyword) return;

    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setDebouncedKeyword(filters.keyword);
    }, searchDelay);

    return () => window.clearTimeout(timeoutId);
  }, [debouncedKeyword, filters.keyword, searchDelay]);

  const requestFilters = useMemo(
    () => ({ ...filters, keyword: debouncedKeyword }) as TFilters,
    [debouncedKeyword, filters],
  );

  const onFiltersChange = useCallback(
    (nextFilters: TFilters) => {
      const keywordChanged = nextFilters.keyword !== filters.keyword;

      if (keywordChanged) {
        void queryClient.cancelQueries({ queryKey });
      } else {
        setDebouncedKeyword(nextFilters.keyword);
        setPage(1);
      }

      setFilters(nextFilters);
    },
    [filters.keyword, queryClient, queryKey],
  );

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      if (nextPageSize === pageSize) return;

      void queryClient.cancelQueries({ queryKey });
      setPage(1);
      setPageSizeState(nextPageSize);
    },
    [pageSize, queryClient, queryKey],
  );

  return {
    filters,
    requestFilters,
    page,
    pageSize,
    setPage,
    setPageSize,
    onFiltersChange,
  };
}
