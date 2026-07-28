'use client';

import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { IconButton, LinearProgress, Tooltip } from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import type { Meeting } from '@/types/meeting';

type MeetingCalendarProps = {
  month: Dayjs;
  meetings: Meeting[];
  isLoading: boolean;
  canCreate: boolean;
  onMonthChange: (month: Dayjs) => void;
  onSelectDate: (date: string) => void;
  onSelectMeeting: (meeting: Meeting) => void;
  onShowMore: (date: string) => void;
};

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

function statusClass(meeting: Meeting) {
  if (meeting.isOverdue) return 'border-rose-300 bg-rose-100 text-rose-800';
  if (meeting.status === 'confirmed') return 'border-emerald-300 bg-emerald-100 text-emerald-800';
  if (meeting.status === 'completed') return 'border-slate-300 bg-slate-100 text-slate-700';
  if (meeting.status === 'cancelled')
    return 'border-rose-200 bg-rose-50 text-rose-500 line-through';
  if (meeting.status === 'no_show') return 'border-amber-300 bg-amber-100 text-amber-800';

  return 'border-sky-300 bg-sky-100 text-sky-800';
}

function meetingLabel(meeting: Meeting) {
  return (
    meeting.subject ||
    meeting.project?.projectCode ||
    meeting.customer?.customerName ||
    meeting.lead?.customerName
  );
}

export function MeetingCalendar({
  month,
  meetings,
  isLoading,
  canCreate,
  onMonthChange,
  onSelectDate,
  onSelectMeeting,
  onShowMore,
}: MeetingCalendarProps) {
  const firstOfMonth = month.startOf('month');
  const mondayOffset = (firstOfMonth.day() + 6) % 7;
  const gridStart = firstOfMonth.subtract(mondayOffset, 'day');
  const dates = Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'));
  const meetingsByDate = meetings.reduce<Record<string, Meeting[]>>((result, meeting) => {
    const key = dayjs(meeting.startsAt).format('YYYY-MM-DD');
    result[key] = [...(result[key] || []), meeting];

    return result;
  }, {});

  return (
    <section className="relative overflow-hidden bg-white">
      {isLoading ? (
        <div className="absolute inset-x-0 top-0 z-30">
          <LinearProgress color="primary" />
        </div>
      ) : null}

      <div className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div />
        <div className="flex items-center gap-2">
          <Tooltip title="Tháng trước">
            <IconButton
              size="small"
              aria-label="Xem tháng trước"
              onClick={() => onMonthChange(month.subtract(1, 'month'))}
            >
              <ChevronLeftRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <strong className="min-w-32 text-center text-base font-extrabold text-slate-950">
            Tháng {month.month() + 1} {month.year()}
          </strong>
          <Tooltip title="Tháng sau">
            <IconButton
              size="small"
              aria-label="Xem tháng sau"
              onClick={() => onMonthChange(month.add(1, 'month'))}
            >
              <ChevronRightRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
        <button
          type="button"
          className="min-h-9 justify-self-end rounded-lg border border-primary/30 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => onMonthChange(dayjs().startOf('month'))}
        >
          Hôm nay
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[920px] grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={`px-3 py-2.5 text-center text-xs font-extrabold uppercase tracking-wide ${
                index >= 5 ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid min-w-[920px] grid-cols-7">
          {dates.map((date) => {
            const dateKey = date.format('YYYY-MM-DD');
            const dayMeetings = meetingsByDate[dateKey] || [];
            const isCurrentMonth = date.month() === month.month();
            const isToday = date.isSame(dayjs(), 'day');
            const isWeekend = date.day() === 0 || date.day() === 6;

            return (
              <div
                key={dateKey}
                className={`h-[84px] overflow-hidden border-b border-r border-slate-200 p-0.5 ${
                  isWeekend ? 'bg-slate-50/70' : 'bg-white'
                } ${isCurrentMonth ? '' : 'text-slate-300'}`}
              >
                <button
                  type="button"
                  title={
                    canCreate
                      ? `Tạo lịch hẹn ngày ${date.format('DD/MM/YYYY')}`
                      : `Ngày ${date.format('DD/MM/YYYY')}`
                  }
                  aria-label={
                    canCreate
                      ? `Tạo lịch hẹn ngày ${date.format('DD/MM/YYYY')}`
                      : `Ngày ${date.format('DD/MM/YYYY')}`
                  }
                  disabled={!canCreate}
                  className={`ml-auto grid size-5 place-items-center rounded-full text-[11px] font-bold transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    isToday
                      ? 'bg-primary text-white hover:bg-primary'
                      : isCurrentMonth
                        ? 'text-slate-700'
                        : 'text-slate-300'
                  }`}
                  onClick={() => onSelectDate(dateKey)}
                >
                  {date.date()}
                </button>

                <div className="space-y-px">
                  {dayMeetings.slice(0, 3).map((meeting) => (
                    <button
                      key={meeting.id}
                      type="button"
                      title={`${dayjs(meeting.startsAt).format('HH:mm')} · ${meeting.subject}`}
                      className={`block h-5 w-full truncate rounded-sm border px-1 text-left text-[12px] font-bold leading-[12px] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${statusClass(meeting)}`}
                      onClick={() => onSelectMeeting(meeting)}
                    >
                      <span className="font-black tabular-nums">
                        {dayjs(meeting.startsAt).format('HH:mm')}
                      </span>{' '}
                      · {meetingLabel(meeting)}
                    </button>
                  ))}
                  {dayMeetings.length > 3 ? (
                    <button
                      type="button"
                      aria-label={`Xem thêm ${dayMeetings.length - 3} lịch ngày ${date.format('DD/MM/YYYY')}`}
                      className="block h-5 px-1 text-[12px] font-bold leading-[14px] text-slate-500 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      onClick={() => onShowMore(dateKey)}
                    >
                      +{dayMeetings.length - 3} lịch khác
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
