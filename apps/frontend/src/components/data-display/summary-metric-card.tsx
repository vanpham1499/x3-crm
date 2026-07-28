import type { ReactNode } from 'react';

type SummaryMetricCardTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';

type SummaryMetricCardProps = {
  label: string;
  helper: string;
  value: ReactNode;
  icon: ReactNode;
  tone: SummaryMetricCardTone;
  active?: boolean;
  valueClassName?: string;
  onClick?: () => void;
};

const TONE_CLASSES: Record<SummaryMetricCardTone, string> = {
  blue: 'border-sky-200 bg-sky-50 text-sky-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function SummaryMetricCard({
  label,
  helper,
  value,
  icon,
  tone,
  active = false,
  valueClassName = 'text-slate-950',
  onClick,
}: SummaryMetricCardProps) {
  const className = `min-w-0 rounded-xl border bg-white p-3 text-left shadow-sm transition ${
    active ? 'border-primary ring-2 ring-primary/15' : 'border-slate-200'
  } ${
    onClick
      ? 'cursor-pointer hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
      : ''
  }`;

  const content = (
    <div className="flex items-center gap-3">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg border [&_.MuiSvgIcon-root]:!text-[19px] ${TONE_CLASSES[tone]}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-5 text-slate-700">{label}</p>
        <p className="truncate text-xs font-semibold leading-4 text-slate-400" title={helper}>
          {helper}
        </p>
      </div>
      <p
        className={`ml-auto shrink-0 whitespace-nowrap text-right text-[22px] font-extrabold tabular-nums ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" aria-pressed={active} className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
