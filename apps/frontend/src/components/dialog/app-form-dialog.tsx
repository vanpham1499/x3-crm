'use client';

import type { FormEventHandler, ReactNode } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import type { DialogProps } from '@mui/material';

type AppFormDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  maxWidth?: DialogProps['maxWidth'];
  submitting?: boolean;
  contentClassName?: string;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function AppFormDialog({
  open,
  title,
  children,
  actions,
  maxWidth = 'md',
  submitting = false,
  contentClassName = '',
  onClose,
  onSubmit,
}: AppFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth={maxWidth}
      fullWidth
      scroll="paper"
      slotProps={{ paper: { className: '!max-h-[calc(100dvh-32px)] !rounded-xl' } }}
    >
      <DialogTitle className="flex items-center justify-between gap-3 border-b border-slate-200 !px-5 !py-3.5">
        <p className="truncate text-base font-bold leading-6 text-slate-950">{title}</p>
        <IconButton
          aria-label="Đóng popup"
          title="Đóng"
          disabled={submitting}
          onClick={onClose}
          className="!h-9 !w-9 !rounded-lg !border !border-slate-200 !text-slate-500 hover:!bg-slate-50"
        >
          <CloseRoundedIcon className="!text-[20px]" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <DialogContent className={`!px-5 !py-4 ${contentClassName}`}>{children}</DialogContent>
        <DialogActions className="gap-2 border-t border-slate-200 !px-5 !py-3">
          {actions}
        </DialogActions>
      </form>
    </Dialog>
  );
}
