'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';

type FormDateTimePickerProps = {
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

function toDateTime(value?: string) {
  if (!value) return null;

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed : null;
}

export function FormDateTimePicker({
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
}: FormDateTimePickerProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
      <DateTimePicker
        label={label}
        value={toDateTime(value)}
        minDateTime={toDateTime(min)}
        maxDateTime={toDateTime(max)}
        format="DD/MM/YYYY HH:mm"
        ampm={false}
        disabled={disabled}
        onChange={(nextValue) =>
          onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM-DDTHH:mm') : '')
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
