'use client';

import { useState } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { ButtonBase, Menu, MenuItem } from '@mui/material';

export type InlineStatusSelectOption = {
  value: string;
  label: string;
  color?: string;
};

type InlineStatusSelectProps = {
  value: string;
  label: string;
  color?: string;
  options: InlineStatusSelectOption[];
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function hexToRgb(color: string) {
  const normalized = color.replace('#', '').trim();
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => character + character)
          .join('')
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(value)) return null;

  const numberValue = Number.parseInt(value, 16);

  return {
    r: (numberValue >> 16) & 255,
    g: (numberValue >> 8) & 255,
    b: numberValue & 255,
  };
}

function statusBadgeStyle(color: string) {
  const rgb = hexToRgb(color);

  if (!rgb) return undefined;

  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`,
    borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.48)`,
    boxShadow: `inset 0 0 0 1px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06), 0 1px 2px rgba(15, 23, 42, 0.08)`,
  };
}

export function InlineStatusSelect({
  value,
  label,
  color = '#64748b',
  options,
  ariaLabel,
  disabled = false,
  onChange,
}: InlineStatusSelectProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const badgeStyle = statusBadgeStyle(color);

  return (
    <>
      <ButtonBase
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        title={label}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        style={badgeStyle}
        className={`!inline-flex !h-9 !min-w-[112px] !max-w-[180px] !justify-between !gap-2 !rounded-lg !border !px-3 !text-xs !font-extrabold !text-slate-800 transition !duration-150 hover:!brightness-[0.98] hover:!shadow-md ${
          badgeStyle ? '' : '!border-slate-300 !bg-slate-100'
        }`}
      >
        <span
          className="size-2.5 shrink-0 rounded-full ring-2 ring-white shadow-sm"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <KeyboardArrowDownRoundedIcon className="!-mr-1 !text-[17px] text-slate-500" />
      </ButtonBase>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <MenuItem
              key={option.value}
              selected={isSelected}
              className="!min-w-[220px] !gap-2.5"
              onClick={() => {
                setAnchorEl(null);
                if (!isSelected) onChange(option.value);
              }}
            >
              <span
                className="size-2.5 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                style={{ backgroundColor: option.color || '#64748b' }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{option.label}</span>
              {isSelected && <CheckRoundedIcon className="!text-[18px] text-primary" />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
