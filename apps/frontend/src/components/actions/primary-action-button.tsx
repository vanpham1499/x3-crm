'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@mui/material';

type PrimaryActionButtonProps = {
  children: ReactNode;
  href?: string;
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
  startIcon,
  disabled = false,
  title,
  type = 'button',
  onClick,
}: PrimaryActionButtonProps) {
  if (href) {
    return (
      <Button
        component={Link}
        href={href}
        variant="contained"
        color="primary"
        size="small"
        startIcon={startIcon}
        disabled={disabled}
        title={title}
        className={buttonClassName}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      type={type}
      variant="contained"
      color="primary"
      size="small"
      startIcon={startIcon}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={buttonClassName}
    >
      {children}
    </Button>
  );
}
