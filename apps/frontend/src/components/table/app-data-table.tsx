'use client';

import type { ReactNode } from 'react';
import { LinearProgress } from '@mui/material';

export type AppDataTableColumn = {
  key: string;
  label?: ReactNode;
  className?: string;
};

type AppDataTableProps = {
  columns: AppDataTableColumn[];
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  minWidthClassName?: string;
};

export function AppDataTable({
  columns,
  children,
  isLoading = false,
  isEmpty = false,
  emptyText = 'Không có dữ liệu',
  minWidthClassName = 'min-w-[960px]',
}: AppDataTableProps) {
  return (
    <div className="relative w-full overflow-x-auto">
      {isLoading && (
        <div className="absolute left-0 right-0 top-0 z-30">
          <LinearProgress color="primary" />
        </div>
      )}

      <table
        aria-busy={isLoading}
        className={`w-full table-fixed text-left text-sm transition-opacity ${minWidthClassName} ${isLoading ? 'opacity-60' : 'opacity-100'}`}
      >
        <thead className="border-y border-slate-200 bg-slate-100 text-[14px] font-bold text-slate-700">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`whitespace-nowrap px-3 py-3.5 ${column.className || ''}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isEmpty ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-sm font-semibold text-slate-500"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
