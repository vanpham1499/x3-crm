'use client';

import { TextField, type TextFieldProps } from '@mui/material';

type MoneyInputProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  allowNegative?: boolean;
};

function normalizeMoneyValue(value: string | number | null | undefined, allowNegative = false) {
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

  const digits = rawValue.replace(/[^\d]/g, '');
  const isNegative = allowNegative && rawValue.startsWith('-');

  if (!digits) return isNegative ? '-' : '';

  return `${isNegative ? '-' : ''}${digits}`;
}

export function formatMoneyInputValue(
  value: string | number | null | undefined,
  allowNegative = false,
) {
  const normalizedValue = normalizeMoneyValue(value, allowNegative);

  if (!normalizedValue) return '';
  if (normalizedValue === '-') return normalizedValue;

  return new Intl.NumberFormat('vi-VN').format(Number(normalizedValue));
}

export function MoneyInput({
  value,
  onValueChange,
  allowNegative = false,
  slotProps,
  ...props
}: MoneyInputProps) {
  return (
    <TextField
      {...props}
      value={formatMoneyInputValue(value, allowNegative)}
      onChange={(event) => onValueChange(normalizeMoneyValue(event.target.value, allowNegative))}
      slotProps={{
        ...slotProps,
        htmlInput: {
          inputMode: allowNegative ? 'decimal' : 'numeric',
          ...slotProps?.htmlInput,
        },
      }}
    />
  );
}
