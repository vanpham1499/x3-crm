'use client';

import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { InputAdornment, TextField } from '@mui/material';

type CompactSearchFieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
};

export function CompactSearchField({
  label,
  placeholder,
  value,
  onChange,
}: CompactSearchFieldProps) {
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="[&_.MuiInputBase-root]:!h-10 [&_.MuiInputLabel-root.Mui-focused]:!text-primary [&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:!border-primary [&_.MuiOutlinedInput-root.Mui-focused_.MuiInputAdornment-root_.MuiSvgIcon-root]:!text-primary"
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon className="!text-[18px] text-slate-400" />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
