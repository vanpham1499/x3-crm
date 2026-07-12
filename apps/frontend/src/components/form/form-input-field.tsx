'use client';

import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import {
  compactFormFieldClassName,
  formFieldFocusClassName,
} from '@/components/form/form-field-styles';

export function FormInputField(props: TextFieldProps) {
  const { className = '', multiline = false, ...rest } = props;
  const fieldClassName = multiline ? formFieldFocusClassName : compactFormFieldClassName;

  return (
    <TextField
      {...rest}
      fullWidth
      size="small"
      multiline={multiline}
      className={`${fieldClassName} ${className}`}
    />
  );
}
