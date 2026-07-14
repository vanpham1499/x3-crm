'use client';

import { createContext, forwardRef, useContext, useEffect, useMemo, useState } from 'react';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Autocomplete, CircularProgress, IconButton, Paper } from '@mui/material';
import type { PaperProps } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormInputField } from '@/components/form/form-input-field';
import api from '@/services/api/client';
import type { PaginatedResponse } from '@/types/pagination';

type AutocompleteRecord = {
  id: number | string;
};

type PaginationContextValue = {
  visible: boolean;
  currentPage: number;
  lastPage: number;
  total: number;
  isFetching: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

const PaginationContext = createContext<PaginationContextValue | null>(null);

const ServerAutocompletePaper = forwardRef<HTMLDivElement, PaperProps>(
  function ServerAutocompletePaper({ children, ...props }, ref) {
    const pagination = useContext(PaginationContext);

    return (
      <Paper {...props} ref={ref}>
        {children}
        {pagination?.visible ? (
          <div
            className="flex min-h-11 items-center justify-between gap-3 border-t border-slate-200 px-3 py-1.5"
            onMouseDown={(event) => event.preventDefault()}
          >
            <span className="whitespace-nowrap text-xs font-medium text-slate-500">
              Trang {pagination.currentPage}/{pagination.lastPage} · {pagination.total} kết quả
            </span>
            <div className="flex items-center gap-1">
              {pagination.isFetching ? (
                <CircularProgress size={16} className="!mr-1 !text-primary" />
              ) : null}
              <IconButton
                size="small"
                aria-label="Trang trước"
                disabled={pagination.currentPage <= 1 || pagination.isFetching}
                onClick={pagination.onPreviousPage}
              >
                <ChevronLeftRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Trang sau"
                disabled={pagination.currentPage >= pagination.lastPage || pagination.isFetching}
                onClick={pagination.onNextPage}
              >
                <ChevronRightRoundedIcon fontSize="small" />
              </IconButton>
            </div>
          </div>
        ) : null}
      </Paper>
    );
  },
);

type ServerPaginatedAutocompleteProps<T extends AutocompleteRecord> = {
  endpoint: string;
  queryKey: readonly unknown[];
  label: string;
  value: T | null;
  getOptionLabel: (option: T) => string;
  onChange: (value: T | null) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  placeholder?: string;
  pageSize?: number;
};

export function ServerPaginatedAutocomplete<T extends AutocompleteRecord>({
  endpoint,
  queryKey,
  label,
  value,
  getOptionLabel,
  onChange,
  className,
  disabled = false,
  required = false,
  error = false,
  helperText,
  placeholder = 'Nhập mã hoặc tên để tìm kiếm',
  pageSize = 10,
}: ServerPaginatedAutocompleteProps<T>) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState(value ? getOptionLabel(value) : '');
  const [pendingKeyword, setPendingKeyword] = useState('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setKeyword(pendingKeyword.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [pendingKeyword]);

  useEffect(() => {
    if (!open) {
      setInputValue(value ? getOptionLabel(value) : '');
    }
  }, [getOptionLabel, open, value]);

  const { data, isFetching, isLoading } = useQuery<PaginatedResponse<T>>({
    queryKey: [...queryKey, { keyword, page, pageSize }],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<T>>(endpoint, {
          params: {
            keyword: keyword || undefined,
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    enabled: open && !disabled,
  });

  const options = data?.data || [];

  const pagination = data?.meta || {
    currentPage: page,
    lastPage: 1,
    perPage: pageSize,
    total: 0,
    from: null,
    to: null,
  };

  const paginationContextValue = useMemo<PaginationContextValue>(
    () => ({
      visible: Boolean(data),
      currentPage: pagination.currentPage,
      lastPage: pagination.lastPage,
      total: pagination.total,
      isFetching,
      onPreviousPage: () => setPage((current) => Math.max(1, current - 1)),
      onNextPage: () => setPage((current) => Math.min(pagination.lastPage, current + 1)),
    }),
    [data, isFetching, pagination.currentPage, pagination.lastPage, pagination.total],
  );

  const resetSearch = () => {
    setPage(1);
    setPendingKeyword('');
    setKeyword('');
  };

  return (
    <PaginationContext.Provider value={paginationContextValue}>
      <Autocomplete<T, false, false, false>
        className={className}
        open={open}
        options={options}
        value={value}
        inputValue={inputValue}
        disabled={disabled}
        loading={isLoading || isFetching}
        loadingText="Đang tải dữ liệu..."
        noOptionsText={keyword ? 'Không có kết quả. Thử nhập mã hoặc tên khác.' : 'Chưa có dữ liệu'}
        clearText="Xóa lựa chọn"
        closeText="Đóng"
        openText="Mở danh sách"
        filterOptions={(currentOptions) => currentOptions}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={(option, selected) => String(option.id) === String(selected.id)}
        onOpen={() => setOpen(true)}
        onClose={() => {
          setOpen(false);
          resetSearch();
        }}
        onInputChange={(_, nextInputValue, reason) => {
          if (reason !== 'input' && reason !== 'clear') return;

          setInputValue(nextInputValue);
          setPendingKeyword(nextInputValue);
          setPage(1);
          void queryClient.cancelQueries({ queryKey });
        }}
        onChange={(_, nextValue) => {
          onChange(nextValue);
          setInputValue(nextValue ? getOptionLabel(nextValue) : '');
          resetSearch();
        }}
        slots={{ paper: ServerAutocompletePaper }}
        renderInput={(params) => (
          <FormInputField
            {...params}
            required={required}
            label={label}
            placeholder={placeholder}
            error={error}
            helperText={helperText}
          />
        )}
      />
    </PaginationContext.Provider>
  );
}
