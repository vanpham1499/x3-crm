'use client';

import { Autocomplete } from '@mui/material';
import { FormInputField } from '@/components/form/form-input-field';

export type CompactAutocompleteOption = {
  value: string;
  label: string;
};

type CompactAutocompleteFieldProps = {
  label: string;
  value: string;
  options: CompactAutocompleteOption[];
  onChange: (value: string) => void;
  allLabel?: string;
  noOptionsText?: string;
};

export function CompactAutocompleteField({
  label,
  value,
  options,
  onChange,
  allLabel = 'Tất cả',
  noOptionsText = 'Không tìm thấy dữ liệu phù hợp',
}: CompactAutocompleteFieldProps) {
  const selectedOption = options.find((option) => option.value === value) || null;

  return (
    <Autocomplete
      fullWidth
      autoHighlight
      options={options}
      value={selectedOption}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) => option.value === selected.value}
      onChange={(_, option) => onChange(option?.value || '')}
      noOptionsText={noOptionsText}
      clearText="Xóa bộ lọc"
      closeText="Đóng"
      openText="Mở danh sách"
      renderInput={(params) => <FormInputField {...params} label={label} placeholder={allLabel} />}
    />
  );
}
