'use client';

import { forwardRef } from 'react';
import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import {
  compactFormFieldClassName,
  formFieldFocusClassName,
} from '@/components/form/form-field-styles';

export const FormInputField = forwardRef<HTMLInputElement, TextFieldProps>(
  function FormInputField(props, ref) {
    const { className = '', inputRef, multiline = false, ...rest } = props;
    const fieldClassName = multiline ? formFieldFocusClassName : compactFormFieldClassName;

    return (
      <TextField
        {...rest}
        fullWidth
        inputRef={inputRef || ref}
        size="small"
        multiline={multiline}
        className={`${fieldClassName} ${className}`}
      />
    );
  },
);
