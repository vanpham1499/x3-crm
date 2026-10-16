'use client';

import { PaginationItem } from '@mui/material';

/** For APIs returning hasMore without a total: never invent a total or last page. */
export function CursorPaginationBar({
  page,
  hasMore,
  disabled = false,
  onPageChange,
}: {
  page: number;
  hasMore: boolean;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav
      aria-label="Phân trang danh sách"
      className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 text-sm"
    >
      <span className="mr-auto text-slate-500">
        Trang <strong className="text-slate-950">{page}</strong>
      </span>
      <PaginationItem
        type="previous"
        shape="rounded"
        size="small"
        aria-label="Trang trước"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      <PaginationItem
        type="page"
        page={page}
        selected
        color="primary"
        shape="rounded"
        size="small"
        aria-label={`Trang hiện tại ${page}`}
      />
      <PaginationItem
        type="next"
        shape="rounded"
        size="small"
        aria-label="Trang sau"
        disabled={disabled || !hasMore}
        onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
}
