'use client';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';

export type ListPaginationData = { page: number; limit: number; total: number };
export function ListPagination({
  page,
  limit,
  total,
  busy,
  onPage,
}: ListPaginationData & {
  busy?: boolean;
  onPage: (page: number) => void;
}) {
  if (total <= limit && page === 0) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <TablePaginationBar
      page={page + 1}
      pageSize={limit}
      totalItems={total}
      totalPages={pages}
      disabled={busy}
      onPageChange={(value) => onPage(value - 1)}
    />
  );
}
