'use client';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Drawer, IconButton } from '@mui/material';

type UtilityDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function UtilityDrawer({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
}: UtilityDrawerProps) {
  const titleId = `utility-drawer-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      ModalProps={{ keepMounted: true }}
      slotProps={{
        backdrop: { className: '!bg-slate-950/30 !backdrop-blur-[1px]' },
        paper: {
          className:
            '!flex !h-dvh !max-w-full !flex-col !overflow-hidden !border-l !border-slate-200 !bg-white !shadow-2xl dark:!border-slate-800 dark:!bg-slate-950',
          sx: { width: { xs: '100%', sm: 420 } },
        },
      }}
    >
      <div className="flex min-h-[72px] shrink-0 items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800">
        <div className="min-w-0 pr-3">
          <h2 id={titleId} className="truncate text-lg font-extrabold text-slate-950 dark:text-white">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <IconButton
            onClick={onClose}
            aria-label={`Đóng ${title.toLowerCase()}`}
            className="!h-11 !w-11 !text-slate-500 dark:!text-slate-300"
          >
            <CloseRoundedIcon />
          </IconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </Drawer>
  );
}
