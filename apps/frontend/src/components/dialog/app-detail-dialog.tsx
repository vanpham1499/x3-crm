'use client';

import type { ReactNode } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Dialog, DialogContent, DialogTitle, IconButton, LinearProgress } from '@mui/material';
import type { DialogProps } from '@mui/material';

type AppDetailDialogProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  maxWidth?: DialogProps['maxWidth'];
  children: ReactNode;
  onClose: () => void;
};

export function AppDetailDialog({
  open,
  title,
  eyebrow,
  subtitle,
  actions,
  loading = false,
  maxWidth = 'md',
  children,
  onClose,
}: AppDetailDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      scroll="paper"
      slotProps={{ paper: { className: '!max-h-[calc(100dvh-32px)] !rounded-xl' } }}
    >
      <DialogTitle className="flex flex-col gap-3 border-b border-slate-200 !px-5 !py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <span className="mb-2 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
              {eyebrow}
            </span>
          )}
          <p className="truncate text-lg font-bold leading-6 text-slate-950">{title}</p>
          {subtitle && <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          <IconButton
            aria-label="Đóng popup"
            title="Đóng"
            onClick={onClose}
            className="!h-9 !w-9 !rounded-lg !border !border-slate-200 !text-slate-500 hover:!bg-slate-50"
          >
            <CloseRoundedIcon className="!text-[20px]" />
          </IconButton>
        </div>
      </DialogTitle>

      <DialogContent className="!p-0">
        {loading && <LinearProgress aria-label="Đang tải dữ liệu" color="primary" />}
        {children}
      </DialogContent>
    </Dialog>
  );
}
