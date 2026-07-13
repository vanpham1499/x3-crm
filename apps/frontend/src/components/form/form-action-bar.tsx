'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';

type FormActionBarProps = {
  cancelHref: string;
  submitLabel: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  submitIcon?: ReactNode;
};

export function FormActionBar({
  cancelHref,
  submitLabel,
  submittingLabel = 'Đang lưu...',
  isSubmitting = false,
  submitDisabled = false,
  submitIcon,
}: FormActionBarProps) {
  return (
    <>
      <div aria-hidden className="mt-auto h-6 shrink-0" />
      <div className="sticky bottom-0 z-20 -mx-6 flex min-h-16 items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] backdrop-blur">
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          Hủy
        </Link>
        <PrimaryActionButton
          type="submit"
          startIcon={submitIcon}
          disabled={isSubmitting || submitDisabled}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </PrimaryActionButton>
      </div>
    </>
  );
}
