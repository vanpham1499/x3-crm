'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/vi';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { viVN } from '@mui/x-date-pickers/locales';

/** Date-only and wall-clock values stay strings; callers own timezone conversion. */
export function TeamDatePicker({
  value,
  onChange,
  label,
  withTime = false,
  disabled = false,
  clearable = true,
  compact = false,
  labelPlacement = 'floating',
  onValidityChange,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  withTime?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  compact?: boolean;
  labelPlacement?: 'floating' | 'above';
  onValidityChange?: (valid: boolean) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const parentTheme = useTheme();
  const theme = useMemo(
    () =>
      createTheme(parentTheme, {
        palette: { primary: { main: '#0068ff' } },
        typography: { fontFamily: "'ZaloTeamSegoe', 'Segoe UI', sans-serif", fontSize: 13 },
      }),
    [parentTheme],
  );
  const [draft, setDraft] = useState<Dayjs | null>(() => (value ? dayjs(value) : null));
  useEffect(() => {
    setDraft(value ? dayjs(value) : null);
    onValidityChange?.(value ? dayjs(value).isValid() : clearable);
  }, [value, clearable, onValidityChange]);
  const container = () => root.current?.closest('dialog') || document.body;
  const boundary = root.current?.closest('dialog') || 'clippingParents';
  const popupStyle = {
    zIndex: 1600,
    '& .Mui-selected, & .Mui-selected:hover, & .Mui-selected:focus': {
      backgroundColor: '#0068ff !important',
      color: '#fff !important',
    },
    '& .MuiDialogActions-root button': {
      color: '#0068ff',
      background: 'transparent',
      border: 0,
      fontSize: 13,
    },
  };
  const common = {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    label,
    value: draft,
    disabled,
    onChange: (next: Dayjs | null, context: { validationError: unknown }) => {
      setDraft(next);
      const valid = !context.validationError && (next ? next.isValid() : clearable);
      onValidityChange?.(valid);
      if (valid) onChange(next ? next.format(withTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD') : '');
    },
    onError: (error: unknown) => {
      if (error) onValidityChange?.(false);
    },
    slotProps: {
      field: { clearable },
      textField: {
        size: 'small' as const,
        fullWidth: true,
        slotProps: { inputLabel: { shrink: true } },
      },
      popper: {
        container,
        sx: popupStyle,
        popperOptions: { strategy: 'fixed' as const },
        modifiers: [
          { name: 'flip', options: { boundary, padding: 8 } },
          { name: 'preventOverflow', options: { boundary, padding: 8, altAxis: true } },
        ],
      },
      dialog: { container, sx: popupStyle },
      actionBar: {
        actions: (clearable ? ['clear', 'cancel', 'accept'] : ['cancel', 'accept']) as (
          'clear' | 'cancel' | 'accept'
        )[],
      },
    },
    sx: {
      width: '100%',
      '& .MuiPickersInputBase-root': {
        fontFamily: "'ZaloTeamSegoe', 'Segoe UI', sans-serif",
        fontSize: 13,
        minHeight: compact ? 32 : 36,
        ...(compact ? { height: 32 } : {}),
        borderRadius: '5px',
        background: '#fff',
      },
      '& .MuiInputLabel-root': {
        fontFamily: "'ZaloTeamSegoe', 'Segoe UI', sans-serif",
        fontSize: 13,
        transform: 'translate(12px, -9px) scale(0.85)',
        background: '#fff',
        padding: '0 3px',
        ...(labelPlacement === 'above'
          ? {
              position: 'static',
              transform: 'none',
              marginBottom: '7px',
              fontSize: 12,
              lineHeight: '18px',
              padding: 0,
              color: '#526783',
              background: 'transparent',
            }
          : {}),
      },
      ...(compact ? { '& .MuiPickersSectionList-root': { padding: '0 !important' } } : {}),
      ...(labelPlacement === 'above'
        ? {
            '& .MuiPickersOutlinedInput-notchedOutline legend': { display: 'none' },
            '& .MuiPickersSectionList-root': {
              opacity: 1,
              ...(compact ? { padding: '0 !important' } : {}),
            },
          }
        : {}),
      '& .MuiPickersOutlinedInput-notchedOutline': {
        borderColor: '#d6dce4',
        ...(labelPlacement === 'above' ? { top: 0 } : {}),
      },
      '& .Mui-focused .MuiPickersOutlinedInput-notchedOutline': {
        borderColor: '#0068ff',
        borderWidth: 1,
      },
      '&& .MuiIconButton-root': {
        padding: '4px',
        border: 0,
        background: 'transparent',
        color: '#60728e',
        margin: 0,
      },
      '& .MuiSvgIcon-root': { fontSize: 20 },
    },
  };
  return (
    <div ref={root} data-team-date-picker>
      <ThemeProvider theme={theme}>
        <LocalizationProvider
          dateAdapter={AdapterDayjs}
          adapterLocale="vi"
          localeText={{
            ...viVN.components.MuiLocalizationProvider.defaultProps.localeText,
            okButtonLabel: 'Chọn',
            cancelButtonLabel: 'Hủy',
            clearButtonLabel: 'Xóa',
            todayButtonLabel: 'Hôm nay',
          }}
        >
          {withTime ? (
            <DateTimePicker
              {...common}
              format="DD/MM/YYYY HH:mm"
              ampm={false}
              timeSteps={{ minutes: 1 }}
            />
          ) : (
            <DatePicker {...common} format="DD/MM/YYYY" />
          )}
        </LocalizationProvider>
      </ThemeProvider>
    </div>
  );
}
