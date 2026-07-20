'use client';

import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { IconButton, InputAdornment } from '@mui/material';

function normalizeExternalUrl(value?: string) {
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

export function ExternalLinkAdornment({ value, ariaLabel }: { value?: string; ariaLabel: string }) {
  const url = normalizeExternalUrl(value);

  return (
    <InputAdornment position="end">
      <IconButton
        type="button"
        size="small"
        edge="end"
        disabled={!url}
        title={url ? 'Mở liên kết trong tab mới' : 'Chưa có liên kết'}
        aria-label={ariaLabel}
        onClick={() => {
          if (!url) return;
          const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
          if (openedWindow) openedWindow.opener = null;
        }}
      >
        <OpenInNewRoundedIcon fontSize="small" />
      </IconButton>
    </InputAdornment>
  );
}
