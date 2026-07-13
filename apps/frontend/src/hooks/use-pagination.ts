'use client';

import { useEffect, useMemo, useState } from 'react';

export function usePagination<T>(
  items: T[],
  { pageSize = 10, resetKey }: { pageSize?: number; resetKey?: unknown } = {},
) {
  const [page, setPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return { page, setPage, pageItems, totalPages, totalItems, pageSize };
}
