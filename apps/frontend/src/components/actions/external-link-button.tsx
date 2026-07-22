'use client';

import type { ReactNode } from 'react';
import { Button } from '@mui/material';

function normalizeExternalUrl(value?: string | null) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return '';

  const candidate = /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;

  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

type ExternalLinkButtonProps = {
  value?: string | null;
  label: string;
  icon: ReactNode;
};

const className =
  '!h-9 !min-h-9 !rounded-lg !border-slate-200 !bg-white !px-3 !text-[13px] !font-bold !text-slate-700 !shadow-none hover:!border-primary hover:!bg-emerald-50 hover:!text-emerald-700';

export function ExternalLinkButton({ value, label, icon }: ExternalLinkButtonProps) {
  const url = normalizeExternalUrl(value);
  const title = url
    ? `Mở link ${label.toLowerCase()} trong tab mới`
    : `Chưa có link ${label.toLowerCase()}`;

  if (!url) {
    return (
      <Button
        disabled
        size="small"
        variant="outlined"
        startIcon={icon}
        title={title}
        aria-label={title}
        className={className}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      size="small"
      variant="outlined"
      startIcon={icon}
      title={title}
      aria-label={title}
      className={className}
    >
      {label}
    </Button>
  );
}
