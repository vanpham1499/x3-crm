import type { ReactNode } from 'react';

type FormSectionProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export function FormSection({ title, children, action }: FormSectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        {action}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}
