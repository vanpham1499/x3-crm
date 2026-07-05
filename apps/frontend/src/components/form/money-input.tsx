'use client';

import { TextField, type TextFieldProps } from '@mui/material';

type MoneyInputProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
};

function normalizeMoneyValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '';

  return String(value).replace(/[^\d]/g, '');
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
