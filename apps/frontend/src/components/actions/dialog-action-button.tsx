'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@mui/material';

type DialogActionButtonProps = {
  children: ReactNode;
  href?: string;
  tone?: 'primary' | 'secondary';
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const baseClassName = '!h-9 !min-h-9 !rounded-lg !px-3 !text-[13px] !font-bold !shadow-none';

export function DialogActionButton({
  children,
  href,
  tone = 'secondary',
  startIcon,
  endIcon,
  disabled = false,
  type = 'button',
  onClick,
}: DialogActionButtonProps) {
  const variant = tone === 'primary' ? 'contained' : 'outlined';
  const className = `${baseClassName} ${
    tone === 'primary'
      ? ''
      : '!border-slate-200 !bg-white !text-slate-700 hover:!border-primary hover:!bg-emerald-50 hover:!text-emerald-700 !leading-[1]'
  }`;

  if (href) {
    return (
      <Button
        component={Link}
        href={href}
        size="small"
        variant={variant}
        startIcon={startIcon}
        endIcon={endIcon}
        disabled={disabled}
        className={className}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      type={type}
      size="small"
      variant={variant}
      startIcon={startIcon}
      endIcon={endIcon}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </Button>
  );
}
