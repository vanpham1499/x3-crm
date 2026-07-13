export const formFieldFocusClassName =
  '[&_.MuiInputLabel-root.Mui-focused]:!text-primary [&_.MuiOutlinedInput-root.Mui-focused_.MuiOutlinedInput-notchedOutline]:!border-primary [&_.MuiOutlinedInput-root.Mui-focused_.MuiSelect-icon]:!text-primary';

export const compactFormFieldClassName =
  `[&_.MuiInputBase-root]:!h-10 ${formFieldFocusClassName}`;
