'use client';

import { TextField } from '@mui/material';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';

type CompactDateFieldProps = {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
};

export function CompactDateField({ label, value, min, max, onChange }: CompactDateFieldProps) {
  return (
    <TextField
      fullWidth
      type="date"
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={compactFormFieldClassName}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { min, max },
      }}
    />
  );
}
