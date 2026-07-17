'use client';

import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { IconButton } from '@mui/material';
import {
  addDaysToDateString,
  getCurrentIsoWeekMondayString,
  getIsoWeekMondayString,
} from '@/lib/weekly-report-schedule';
import { formatDate } from '@/lib/utils';

type WeeklyCycleNavigatorProps = {
  weekStart: string;
  disabled?: boolean;
  maxWeekStart?: string;
  onChange: (weekStart: string) => void;
};

export function WeeklyCycleNavigator({
  weekStart,
  disabled = false,
  maxWeekStart,
  onChange,
}: WeeklyCycleNavigatorProps) {
  const normalizedWeekStart = getIsoWeekMondayString(weekStart);
  const weekEnd = addDaysToDateString(normalizedWeekStart, 6);
  const currentWeekStart = getCurrentIsoWeekMondayString();
  const normalizedMaxWeekStart = maxWeekStart ? getIsoWeekMondayString(maxWeekStart) : '';
  const isAtMaximumWeek = Boolean(
    normalizedMaxWeekStart && normalizedWeekStart >= normalizedMaxWeekStart,
  );

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5">
      <IconButton
        size="small"
        disabled={disabled}
        aria-label="Xem tuần trước"
        title="Tuần trước"
        onClick={() => onChange(addDaysToDateString(normalizedWeekStart, -7))}
      >
        <ArrowBackIosNewRoundedIcon className="!text-[16px]" />
      </IconButton>

      <div className="flex h-10 min-w-[240px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
        <CalendarMonthOutlinedIcon className="!text-[18px] text-primary" />
        <span className="whitespace-nowrap">
          Tuần {formatDate(normalizedWeekStart)} – {formatDate(weekEnd)}
        </span>
      </div>

      <IconButton
        size="small"
        disabled={disabled || isAtMaximumWeek}
        aria-label="Xem tuần sau"
        title={isAtMaximumWeek ? 'Không thể chọn tuần tương lai' : 'Tuần sau'}
        onClick={() => onChange(addDaysToDateString(normalizedWeekStart, 7))}
      >
        <ArrowForwardIosRoundedIcon className="!text-[16px]" />
      </IconButton>

      {!disabled && normalizedWeekStart !== currentWeekStart ? (
        <button
          type="button"
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => onChange(currentWeekStart)}
        >
          Tuần hiện tại
        </button>
      ) : null}
    </div>
  );
}
