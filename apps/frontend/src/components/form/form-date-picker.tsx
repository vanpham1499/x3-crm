'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';

type FormDatePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  className?: string;
};

function toDate(value?: string) {
  if (!value) return null;

  const parsed = dayjs(value, 'YYYY-MM-DD', true);
  return parsed.isValid() ? parsed : null;
}

export function FormDatePicker({
  label,
  value,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  error = false,
  helperText,
  className = '',
}: FormDatePickerProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
      <DatePicker
        label={label}
        value={toDate(value)}
        minDate={toDate(min)}
        maxDate={toDate(max)}
        format="DD/MM/YYYY"
        disabled={disabled}
        onChange={(nextValue) =>
          onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM-DD') : '')
        }
        slotProps={{
          textField: {
            fullWidth: true,
            size: 'small',
            required,
            error,
            helperText,
            className: `${compactFormFieldClassName} ${className}`,
          },
        }}
      />
    </LocalizationProvider>
  );
}
