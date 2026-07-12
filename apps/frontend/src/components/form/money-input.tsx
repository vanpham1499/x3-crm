'use client';

import { TextField, type TextFieldProps } from '@mui/material';

type MoneyInputProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
};

function normalizeMoneyValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.round(value)) : '';
  }

  const rawValue = value.trim();
  if (!rawValue) return '';

  // PostgreSQL decimal values are returned as strings such as "2122222.00".
  // Treat one dot followed by 1-2 digits as a decimal separator, while values
  // such as "2.122.222" remain Vietnamese thousand-separated input.
  if (/^-?\d+\.\d{1,2}$/.test(rawValue)) {
    return String(Math.round(Number(rawValue)));
  }

  return rawValue.replace(/[^\d]/g, '');
}

export function formatMoneyInputValue(value: string | number | null | undefined) {
  const normalizedValue = normalizeMoneyValue(value);

  if (!normalizedValue) return '';

  return new Intl.NumberFormat('vi-VN').format(Number(normalizedValue));
}

export function MoneyInput({ value, onValueChange, slotProps, ...props }: MoneyInputProps) {
  return (
    <TextField
      {...props}
      value={formatMoneyInputValue(value)}
      onChange={(event) => onValueChange(normalizeMoneyValue(event.target.value))}
      slotProps={{
        ...slotProps,
        htmlInput: {
          inputMode: 'numeric',
          ...slotProps?.htmlInput,
        },
      }}
    />
  );
}
