'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@mui/material';

type TabActionButtonProps = {
  children: ReactNode;
  href?: string;
  tone?: 'primary' | 'secondary';
  startIcon?: ReactNode;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const baseClassName = '!h-8 !min-h-8 !rounded-lg !px-3 !text-xs !font-bold !shadow-none';

export function TabActionButton({
  children,
  href,
  tone = 'primary',
  startIcon,
  disabled = false,
  onClick,
}: TabActionButtonProps) {
  const variant = tone === 'primary' ? 'contained' : 'outlined';
  const className = `${baseClassName} ${
    tone === 'secondary'
      ? '!border-slate-200 !bg-white !text-slate-700 hover:!border-primary hover:!bg-emerald-50 hover:!text-emerald-700'
      : ''
  }`;

  if (href) {
    return (
      <Button
        component={Link}
        href={href}
        variant={variant}
        color="primary"
        size="small"
        startIcon={startIcon}
        disabled={disabled}
        className={className}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      color="primary"
      size="small"
      startIcon={startIcon}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </Button>
  );
}
