'use client';

import type { ReactNode } from 'react';
import { Autocomplete } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FormInputField } from '@/components/form/form-input-field';
import { fetchVietQrBanks, getVietQrBankLabel, type VietQrBank } from '@/lib/vietqr-banks';

type VietQrBankSelectProps = {
  valueCode?: string;
  valueName?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  onChange: (bank: VietQrBank | null) => void;
};

export function VietQrBankSelect({
  valueCode = '',
  valueName = '',
  label = 'Ngân hàng',
  required = false,
  disabled = false,
  error = false,
  helperText,
  onChange,
}: VietQrBankSelectProps) {
  const {
    data: banks = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ['vietqr-banks'],
    queryFn: fetchVietQrBanks,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const normalizedCode = valueCode.trim().toUpperCase();
  const normalizedName = valueName.trim().toLowerCase();
  const selectedBank =
    banks.find((bank) => normalizedCode && bank.code.toUpperCase() === normalizedCode) ||
    banks.find((bank) => normalizedName && bank.name.trim().toLowerCase() === normalizedName) ||
    null;

  return (
    <Autocomplete
      options={banks}
      value={selectedBank}
      disabled={disabled}
      loading={isFetching}
      autoHighlight
      openOnFocus
      onChange={(_, bank) => onChange(bank)}
      getOptionLabel={getVietQrBankLabel}
      isOptionEqualToValue={(option, value) => option.code === value.code}
      loadingText="Đang tải ngân hàng VietQR..."
      noOptionsText={isFetching ? 'Đang tải ngân hàng VietQR...' : 'Không có ngân hàng'}
      renderOption={(props, bank) => (
        <li {...props} key={bank.code}>
          <div className="flex min-w-0 items-center gap-3">
            {bank.logo ? (
              <img
                src={bank.logo}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full object-contain"
              />
            ) : (
              <span className="h-6 w-6 shrink-0 rounded-full bg-slate-100" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">
                {bank.shortName || bank.code}
              </p>
              <p className="truncate text-xs text-slate-500">{bank.name}</p>
            </div>
          </div>
        </li>
      )}
      renderInput={(params) => (
        <FormInputField
          {...params}
          required={required}
          label={label}
          error={error || isError}
          helperText={isError ? 'Không tải được danh sách ngân hàng VietQR' : helperText}
        />
      )}
    />
  );
}
