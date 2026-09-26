'use client';

import { useState } from 'react';
import { InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { formatWeeklyReportNumber, parseWeeklyReportAmount } from '@/lib/weekly-report-money';
import type { WeeklyReportCurrency } from '@/types/weekly-report';

type WeeklyReportMoneyInputProps = Omit<
  TextFieldProps<'outlined'>,
  'value' | 'onChange' | 'onBlur' | 'onFocus' | 'type' | 'slotProps' | 'ref' | 'variant'
> & {
  value: string;
  currency: WeeklyReportCurrency;
  onValueChange: (value: string) => void;
};

// A report-local decimal input; it does not change the global VND MoneyInput.
export function WeeklyReportMoneyInput({
  value,
  currency,
  onValueChange,
  error,
  helperText,
  className = '',
  ...props
}: WeeklyReportMoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const amount = parseWeeklyReportAmount(value);
  const invalid = value !== '' && amount === null;
  return (
    <TextField
      fullWidth
      size="small"
      {...props}
      className={`${compactFormFieldClassName} ${className}`}
      variant="outlined"
      type="text"
      value={
        focused || value === '' || invalid ? value : formatWeeklyReportNumber(amount, currency)
      }
      error={Boolean(error || invalid)}
      helperText={
        helperText ||
        (invalid ? 'Nhập số không âm, tối đa 2 chữ số thập phân; ví dụ 1234,56.' : undefined)
      }
      onFocus={() => setFocused(true)}
      onBlur={() => {
        if (amount !== null) onValueChange(amount);
        setFocused(false);
      }}
      onChange={(event) => onValueChange(event.target.value)}
      slotProps={{
        input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> },
        htmlInput: { inputMode: 'decimal', autoComplete: 'off', maxLength: 24 },
      }}
    />
  );
}
