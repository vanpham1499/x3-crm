import type { ReactNode } from 'react';
import Link from 'next/link';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

export type CrmFlowStep = {
  label: string;
  state: 'done' | 'active' | 'pending';
  href?: string;
};

type CrmFlowBarProps = {
  steps: CrmFlowStep[];
  action?: ReactNode;
};

const stepClasses = {
  done: {
    item: 'text-emerald-700',
    marker: 'border-emerald-600 bg-emerald-600 text-white',
  },
  active: {
    item: 'brand-blue-text',
    marker: 'brand-blue-marker',
  },
  pending: {
    item: 'text-slate-400',
    marker: 'border-slate-200 bg-white text-slate-400',
  },
};

export function CrmFlowBar({ steps, action }: CrmFlowBarProps) {
  return (
    <section
      aria-label="Luồng CRM"
      className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
        {steps.map((step, index) => {
          const classes = stepClasses[step.state];
          const content = (
            <span
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-bold ${classes.item} ${step.href ? 'transition hover:bg-slate-50' : ''}`}
            >
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${classes.marker}`}
              >
                {step.state === 'done' ? (
                  <CheckRoundedIcon className="!text-[16px]" />
                ) : (
                  index + 1
                )}
              </span>
              <span>{step.label}</span>
            </span>
          );

          return (
            <li key={step.label} className="flex items-center gap-2">
              {step.href ? <Link href={step.href}>{content}</Link> : content}
              {index < steps.length - 1 && (
                <ChevronRightRoundedIcon className="!text-[20px] text-slate-300" />
              )}
            </li>
          );
        })}
      </ol>

      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}
