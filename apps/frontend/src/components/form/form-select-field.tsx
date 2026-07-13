'use client';

import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';

export function FormSelectField(props: TextFieldProps) {
  const { className = '', ...rest } = props;

  return (
    <TextField
      {...rest}
      fullWidth
      select
      size="small"
      className={`${compactFormFieldClassName} ${className}`}
    />
  );
}
