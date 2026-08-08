import type { CSSProperties } from 'react';
import { getOptionColor } from '@/lib/option-utils';
import type { AppOption } from '@/types/option';

type OptionStatusBadgeProps = {
  label?: string | null;
  option?: AppOption | null;
  emptyLabel?: string;
};

function hexToRgb(color: string) {
  const normalized = color.replace('#', '').trim();

  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;

  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function badgeStyle(option?: AppOption | null): CSSProperties | undefined {
  if (!option) return undefined;

  const color = getOptionColor(option);
  const rgb = hexToRgb(color);

  if (!rgb) return undefined;

  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
    borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.36)`,
  };
}

export function OptionStatusBadge({
  label,
  option,
  emptyLabel = 'Chưa chọn',
}: OptionStatusBadgeProps) {
  const displayLabel = label || emptyLabel;
  const color = option ? getOptionColor(option) : '#64748b';
  const style = badgeStyle(option);

  return (
    <span
      title={displayLabel}
      style={style}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-bold text-slate-800 ${
        style ? '' : 'border-slate-200 bg-slate-100'
      }`}
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full ring-2 ring-white"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}
