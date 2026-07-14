'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@mui/material';

type PrimaryActionButtonProps = {
  children: ReactNode;
  href?: string;
  tone?: 'primary' | 'secondary';
  startIcon?: ReactNode;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const buttonClassName = '!h-10 !min-h-10 !rounded-lg !px-4';

export function PrimaryActionButton({
  children,
  href,
  tone = 'primary',
  startIcon,
  disabled = false,
  title,
  type = 'button',
  onClick,
}: PrimaryActionButtonProps) {
  const variant = tone === 'primary' ? 'contained' : 'outlined';
  const className = `${buttonClassName} ${
    tone === 'secondary'
      ? '!border-slate-200 !bg-white !text-slate-700 !shadow-none hover:!border-primary hover:!bg-emerald-50 hover:!text-emerald-700'
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
        title={title}
        className={className}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      type={type}
      variant={variant}
      color="primary"
      size="small"
      startIcon={startIcon}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={className}
    >
      {children}
    </Button>
  );
}
