import { formatDateTime } from '@/lib/utils';

type UserDateTimeCellProps = {
  userName?: string | null;
  dateTime?: string | null;
  emptyUserLabel?: string;
};

export function UserDateTimeCell({
  userName,
  dateTime,
  emptyUserLabel = 'Hệ thống',
}: UserDateTimeCellProps) {
  const displayName = userName?.trim() || emptyUserLabel;

  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate text-xs font-bold text-slate-700" title={displayName}>
        {displayName}
      </p>
      <p className="mt-1 whitespace-nowrap text-[11px] font-medium tabular-nums text-slate-400">
        {dateTime ? formatDateTime(dateTime) : '-'}
      </p>
    </div>
  );
}
