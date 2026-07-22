type ServiceTableCellProps = {
  code?: string | null;
  name?: string | null;
};

export function ServiceTableCell({ code, name }: ServiceTableCellProps) {
  const serviceCode = code?.trim() || '';
  const serviceName = name?.trim() || '-';
  const title = [serviceCode, name?.trim()].filter(Boolean).join(' - ') || '-';

  return (
    <div className="flex min-w-0 items-center gap-2" title={title}>
      {serviceCode ? (
        <span className="shrink-0 rounded-md bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-100">
          {serviceCode}
        </span>
      ) : null}
      <span className="min-w-0 truncate font-medium text-slate-700">{serviceName}</span>
    </div>
  );
}
