'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';

type CompactYearPickerProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
};

export function CompactYearPicker({ label = 'Chọn năm', value, onChange }: CompactYearPickerProps) {
  const selectedYear = value ? dayjs(`${value}-01-01`, 'YYYY-MM-DD', true) : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
      <DatePicker
        label={label}
        value={selectedYear?.isValid() ? selectedYear : null}
        views={['year']}
        openTo="year"
        format="YYYY"
        onChange={(nextValue) => onChange(nextValue?.isValid() ? nextValue.format('YYYY') : '')}
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
