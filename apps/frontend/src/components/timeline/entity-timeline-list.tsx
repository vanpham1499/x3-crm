import { getOptionColor } from '@/lib/option-utils';
import { formatDateTime } from '@/lib/utils';
import type { LeadTimelineEntry } from '@/types/lead';
import type { AppOption } from '@/types/option';

type EntityTimelineListProps = {
  entries: LeadTimelineEntry[];
  statusOptions?: AppOption[];
  fallbackStatusOption?: AppOption | null;
  emptyText: string;
};

function stringValue(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  return String(value);
}

function getEntryData(entry: LeadTimelineEntry) {
  if (entry.contentData) return entry.contentData;
  if (!entry.content) return null;

  try {
    const parsed = JSON.parse(entry.content);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getEntryColor(
  entry: LeadTimelineEntry,
  statusOptions: AppOption[],
  fallbackStatusOption?: AppOption | null,
) {
  if (entry.statusOption) return getOptionColor(entry.statusOption);

  const status = getEntryData(entry)?.status;
  const matchedOption = status
    ? statusOptions.find(
        (option) =>
          (status.id && String(option.id) === String(status.id)) ||
          (status.key && option.key === status.key) ||
          (status.label && option.label === status.label),
      )
    : null;

  if (matchedOption) return getOptionColor(matchedOption);

  const statusColor = status?.color || status?.meta?.color;
  if (typeof statusColor === 'string' && statusColor.trim()) return statusColor;

  return fallbackStatusOption ? getOptionColor(fallbackStatusOption) : '#2563eb';
}

function getEntryTime(entry: LeadTimelineEntry) {
  return entry.occurredAt || entry.createdAt || entry.updatedAt || entry.time || '';
}

function getEntryActor(entry: LeadTimelineEntry) {
  return (
    entry.actor ||
    getEntryData(entry)?.actor ||
    entry.user ||
    entry.createdBy ||
    entry.updatedBy ||
    null
  );
}

function getEntryTitle(entry: LeadTimelineEntry) {
  const data = getEntryData(entry);

  return data?.title || entry.title || data?.action || entry.action || entry.type || 'Cập nhật';
}

function getEntryDescription(entry: LeadTimelineEntry) {
  const data = getEntryData(entry);

  if (entry.description || entry.note || data?.note) {
    return entry.description || entry.note || data?.note || '';
  }

  return data ? '' : entry.content || '';
}

function getEntryChanges(entry: LeadTimelineEntry) {
  return entry.changes || getEntryData(entry)?.changes || [];
}

export function EntityTimelineList({
  entries,
  statusOptions = [],
  fallbackStatusOption,
  emptyText,
}: EntityTimelineListProps) {
  if (entries.length === 0) {
    return <p className="text-sm font-medium text-slate-500">{emptyText}</p>;
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, index) => {
        const color = getEntryColor(entry, statusOptions, fallbackStatusOption);
        const actor = getEntryActor(entry);
        const time = getEntryTime(entry);
        const title = getEntryTitle(entry);
        const description = getEntryDescription(entry);
        const changes = getEntryChanges(entry);

        return (
          <li
            key={entry.id || `${time}-${index}`}
            className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
          >
            <div className="relative flex justify-center">
              {index < entries.length - 1 && (
                <span className="absolute top-5 h-full w-px bg-slate-200" />
              )}
              <span
                className="relative mt-1 h-3 w-3 rounded-full ring-4 ring-white"
                style={{ backgroundColor: color }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{title}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {formatDateTime(time)}
                {actor?.name ? ` - ${actor.name}` : ''}
              </p>
              {description && (
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                  {description}
                </p>
              )}
              {changes.length > 0 && (
                <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3">
                  {changes.map((change, changeIndex) => (
                    <p
                      key={`${change.field || change.label}-${changeIndex}`}
                      className="text-xs text-slate-600"
                    >
                      <span className="font-bold text-slate-800">
                        {change.label || change.field || 'Trường dữ liệu'}:
                      </span>{' '}
                      {stringValue(change.oldValue ?? change.old ?? change.from)} →{' '}
                      {stringValue(change.newValue ?? change.new ?? change.to)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
