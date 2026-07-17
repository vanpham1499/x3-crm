'use client';

import { useId } from 'react';
import { MenuItem, Pagination, Select } from '@mui/material';

export function TablePaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  rangeLabel = 'Hiển thị',
  pageSizeLabel = 'Số dòng',
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  rangeLabel?: string;
  pageSizeLabel?: string;
}) {
  const pageSizeLabelId = useId();

  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
      <p className="text-sm text-slate-500">
        {rangeLabel}{' '}
        <strong className="text-slate-950">
          {start}-{end}
        </strong>{' '}
        trong tổng <strong className="text-slate-950">{totalItems}</strong>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        {onPageSizeChange && (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span id={pageSizeLabelId} className="text-sm font-medium text-slate-500">
              {pageSizeLabel}
            </span>
            <Select
              size="small"
              labelId={pageSizeLabelId}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              MenuProps={{ disableScrollLock: true }}
              className="!h-8 !min-w-[68px] !rounded-lg !text-sm"
              sx={{
                '& .MuiSelect-select': {
                  paddingTop: '4px',
                  paddingBottom: '4px',
                  paddingLeft: '10px',
                  paddingRight: '26px !important',
                },
              }}
            >
              {pageSizeOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => onPageChange(value)}
            color="primary"
            size="small"
            shape="rounded"
          />
        )}
      </div>
    </div>
  );
}
