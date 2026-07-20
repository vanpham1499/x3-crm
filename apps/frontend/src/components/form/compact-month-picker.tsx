'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';

type CompactMonthPickerProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
};

export function CompactMonthPicker({
  label = 'Ch\u1ecdn th\u00e1ng',
  value,
  onChange,
}: CompactMonthPickerProps) {
  const selectedMonth = value ? dayjs(`${value}-01`, 'YYYY-MM-DD', true) : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
      <DatePicker
        label={label}
        value={selectedMonth?.isValid() ? selectedMonth : null}
        views={['year', 'month']}
        openTo="month"
        format="MM/YYYY"
        onChange={(nextValue) => onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM') : '')}
        slotProps={{
          textField: {
            fullWidth: true,
            size: 'small',
            className: compactFormFieldClassName,
          },
        }}
      />
    </LocalizationProvider>
  );
}
