'use client';

import { forwardRef } from 'react';
import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';

export const FormSelectField = forwardRef<HTMLInputElement, TextFieldProps>(
  function FormSelectField(props, ref) {
    const { className = '', inputRef, ...rest } = props;

    return (
      <TextField
        {...rest}
        fullWidth
        inputRef={inputRef || ref}
        select
        size="small"
        className={`${compactFormFieldClassName} ${className}`}
      />
    );
  },
);
