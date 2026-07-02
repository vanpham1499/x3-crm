'use client';

import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { className: 'rounded-2xl' } }}
    >
      <DialogTitle className="flex items-center gap-3 pb-2">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <WarningAmberRoundedIcon />
        </span>
        <span className="text-lg font-bold text-slate-950">{title}</span>
      </DialogTitle>
      <DialogContent>
        <DialogContentText className="text-sm text-slate-500">{description}</DialogContentText>
      </DialogContent>
      <DialogActions className="px-6 pb-5">
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          className="!bg-red-600 hover:!bg-red-700"
        >
          {loading ? 'Đang xử lý...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
