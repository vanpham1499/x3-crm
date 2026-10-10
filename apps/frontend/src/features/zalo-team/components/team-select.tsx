'use client';
import {
  Children,
  Fragment,
  isValidElement,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { Icon } from './icon';
import styles from '../zalo-team.module.css';

type Option = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  description?: string;
};
export type TeamSelectProps = Pick<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'name' | 'disabled' | 'required' | 'aria-label' | 'aria-labelledby' | 'className'
> & {
  value?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  children?: ReactNode;
  options?: Option[];
  placeholder?: string;
  appearance?: 'field' | 'chip';
  leadingIcon?: ReactNode;
};
function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)
    )
      return [];
    if (child.type === Fragment) return readOptions(child.props.children);
    if (child.type !== 'option') return [];
    return [
      {
        value: String(child.props.value ?? ''),
        label: child.props.children,
        disabled: child.props.disabled,
      },
    ];
  });
}
const font = "'ZaloTeamSegoe', 'Segoe UI', sans-serif";
export function TeamSelect({
  value = '',
  onChange,
  children,
  options,
  placeholder = 'Chọn',
  className,
  appearance = 'field',
  leadingIcon,
  ...props
}: TeamSelectProps) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const items = options || readOptions(children);
  const selected = items.find((item) => item.value === String(value));
  return (
    <Select<string>
      {...props}
      ref={root}
      className={styles.teamSelect + (className ? ' ' + className : '')}
      value={selected ? String(value) : ''}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      displayEmpty
      size="small"
      onChange={(event) => onChange?.({ target: { value: String(event.target.value) } })}
      inputProps={{
        'aria-label': props['aria-label'],
        'aria-labelledby': props['aria-labelledby'],
      }}
      renderValue={() => (
        <span className={styles.teamSelectValue}>
          {leadingIcon || selected?.icon}
          <span>{selected?.label || placeholder}</span>
        </span>
      )}
      IconComponent={({ className: iconClass }) => (
        <span className={iconClass}>
          <Icon name="chevronDown" size={14} />
        </span>
      )}
      MenuProps={{
        container: () => root.current?.closest('dialog') || document.body,
        disableScrollLock: true,
        slotProps: {
          root: { 'data-team-select-menu': 'true' } as Record<string, string>,
          paper: {
            sx: {
              mt: 0.5,
              maxHeight: 280,
              maxWidth: 'calc(100vw - 24px)',
              border: '1px solid #dce2ea',
              borderRadius: '6px',
              boxShadow: '0 6px 20px #081b3a24',
              '& .MuiMenuItem-root': {
                fontFamily: font,
                fontSize: 14,
                minHeight: 36,
                alignItems: 'center',
                lineHeight: '20px',
                mx: 0.5,
                px: 1,
                borderRadius: '4px',
                gap: 1,
                color: '#081b3a',
                '&.Mui-selected': { background: '#e5f1ff', color: '#005ae0' },
                '&.Mui-focusVisible, &:hover': { background: '#f0f5fc' },
              },
            },
          },
          list: {
            'aria-label': props['aria-label'],
            onKeyDownCapture: (event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }
            },
            sx: { py: 0.5 },
          },
        },
      }}
      sx={{
        width: '100%',
        minWidth: 0,
        height: appearance === 'chip' ? 24 : 'var(--team-select-height, 32px)',
        fontFamily: font,
        fontSize: 13,
        color: '#081b3a',
        borderRadius: appearance === 'chip' ? '14px' : '5px',
        background: appearance === 'chip' ? '#e5e7eb' : '#fff',
        '& .MuiSelect-select': {
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          height: '100% !important',
          py: '0px',
          pl: appearance === 'chip' ? '8px' : '10px',
          pr: appearance === 'chip' ? '22px !important' : '30px !important',
          minHeight: '0 !important',
        },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#dce2ea',
          ...(appearance === 'chip' ? { border: 0 } : {}),
        },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#97b5db' },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderWidth: 1,
          borderColor: '#0068ff',
        },
        '&.Mui-focused': { boxShadow: '0 0 0 2px #0068ff14' },
        '& .MuiSelect-icon': { top: 'calc(50% - 7px)', right: 10, height: 14, color: '#60728e' },
      }}
    >
      {items.map((item) => (
        <MenuItem key={item.value} value={item.value} disabled={item.disabled}>
          {item.icon}
          <span className={styles.teamSelectOptionText}>
            {item.label}
            {item.description && <small>{item.description}</small>}
          </span>
          {String(value) === item.value && (
            <span className={styles.teamSelectCheck} aria-hidden="true">
              ✓
            </span>
          )}
        </MenuItem>
      ))}
    </Select>
  );
}
