'use client';

import { MenuItem, TextField } from '@mui/material';

export type CompactSelectOption = {
  value: string;
  label: string;
};

type CompactSelectFieldProps = {
  label: string;
  value: string;
  options: CompactSelectOption[];
  onChange: (value: string) => void;
  allLabel?: string;
};

export function CompactSelectField({
  label,
  value,
  options,
  onChange,
  allLabel = 'Tất cả',
}: CompactSelectFieldProps) {
  return (
    <TextField
      fullWidth
      select
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="[&_.MuiInputBase-root]:!h-10 [&_.MuiInputLabel-root.Mui-focused]:!text-primary [&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:!border-primary [&_.MuiOutlinedInput-root.Mui-focused_.MuiSelect-icon]:!text-primary"
    >
      <MenuItem value="">{allLabel}</MenuItem>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
