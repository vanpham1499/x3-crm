'use client';

import { MenuItem } from '@mui/material';
import { CompactMonthPicker } from '@/components/form/compact-month-picker';
import { CompactYearPicker } from '@/components/form/compact-year-picker';
import { FormSelectField } from '@/components/form/form-select-field';
import type { DashboardPeriodFilters } from '@/types/dashboard';

type DashboardPeriodFiltersProps = {
  filters: DashboardPeriodFilters;
  comparisonLabel: string;
  onChange: (filters: DashboardPeriodFilters) => void;
};

export function DashboardPeriodFilterBar({
  filters,
  comparisonLabel,
  onChange,
}: DashboardPeriodFiltersProps) {
  const update = (next: Partial<DashboardPeriodFilters>) => onChange({ ...filters, ...next });
  const fieldClassName = 'w-full sm:w-[220px] sm:flex-none';

  return (
    <div className="w-full sm:w-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <div className={fieldClassName}>
          <FormSelectField
            label="Kỳ báo cáo"
            value={filters.mode}
            onChange={(event) =>
              update({ mode: event.target.value as DashboardPeriodFilters['mode'] })
            }
          >
            <MenuItem value="month">Theo tháng</MenuItem>
            <MenuItem value="quarter">Theo quý</MenuItem>
            <MenuItem value="year">Theo năm</MenuItem>
            <MenuItem value="range">Khoảng tháng</MenuItem>
          </FormSelectField>
        </div>

        {filters.mode === 'month' && (
          <div className={fieldClassName}>
            <CompactMonthPicker
              label="Tháng báo cáo"
              value={filters.month}
              onChange={(month) => month && update({ month })}
            />
          </div>
        )}

        {filters.mode === 'quarter' && (
          <>
            <div className={fieldClassName}>
              <FormSelectField
                label="Quý báo cáo"
                value={filters.quarter}
                onChange={(event) => update({ quarter: event.target.value })}
              >
                <MenuItem value="1">Quý 1</MenuItem>
                <MenuItem value="2">Quý 2</MenuItem>
                <MenuItem value="3">Quý 3</MenuItem>
                <MenuItem value="4">Quý 4</MenuItem>
              </FormSelectField>
            </div>
            <div className={fieldClassName}>
              <CompactYearPicker
                label="Năm báo cáo"
                value={filters.year}
                onChange={(year) => year && update({ year })}
              />
            </div>
          </>
        )}

        {filters.mode === 'year' && (
          <div className={fieldClassName}>
            <CompactYearPicker
              label="Năm báo cáo"
              value={filters.year}
              onChange={(year) => year && update({ year })}
            />
          </div>
        )}

        {filters.mode === 'range' && (
          <>
            <div className={fieldClassName}>
              <CompactMonthPicker
                label="Từ tháng"
                value={filters.periodFrom}
                onChange={(periodFrom) => {
                  if (!periodFrom) return;
                  update({
                    periodFrom,
                    periodTo: periodFrom > filters.periodTo ? periodFrom : filters.periodTo,
                  });
                }}
              />
            </div>
            <div className={fieldClassName}>
              <CompactMonthPicker
                label="Đến tháng"
                value={filters.periodTo}
                onChange={(periodTo) => {
                  if (!periodTo) return;
                  update({
                    periodFrom: periodTo < filters.periodFrom ? periodTo : filters.periodFrom,
                    periodTo,
                  });
                }}
              />
            </div>
          </>
        )}
      </div>

      <p className="mt-1.5 text-right text-[11px] font-semibold text-slate-400">
        So sánh với {comparisonLabel}
      </p>
    </div>
  );
}
