'use client';
import styles from './list-pagination.module.css';

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
    <nav className={styles.pagination} aria-label="Phân trang danh sách">
      <span role="status">
        {total ? page * limit + 1 : 0}–{Math.min((page + 1) * limit, total)} / {total}
      </span>
      <button disabled={busy || page === 0} onClick={() => onPage(page - 1)}>
        Trước
      </button>
      <span>
        Trang {page + 1} / {pages}
      </span>
      <button disabled={busy || page + 1 >= pages} onClick={() => onPage(page + 1)}>
        Sau
      </button>
    </nav>
  );
}
