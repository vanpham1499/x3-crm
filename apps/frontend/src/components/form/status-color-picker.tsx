'use client';

import { useState } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ColorizeRoundedIcon from '@mui/icons-material/ColorizeRounded';
import InputAdornment from '@mui/material/InputAdornment';
import { Button, IconButton, Popover, Tooltip } from '@mui/material';
import type { PointerEvent as ReactPointerEvent, ReactNode, Ref } from 'react';
import { FormInputField } from '@/components/form/form-input-field';
import { DEFAULT_STATUS_COLOR, STATUS_COLOR_PRESETS } from '@/lib/status-colors';

type StatusColorPickerProps = {
  value: string;
  name?: string;
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

type HsvColor = {
  h: number;
  s: number;
  v: number;
};

function normalizeHexDraft(value: string) {
  const hexadecimal = value
    .replace(/[^0-9a-f]/gi, '')
    .slice(0, 6)
    .toUpperCase();

  return `#${hexadecimal}`;
}

function isHexColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value);
}

function hexToHsv(hex: string): HsvColor {
  const normalized = (isHexColor(hex) ? hex : DEFAULT_STATUS_COLOR).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    if (max === green) hue = 60 * ((blue - red) / delta + 2);
    if (max === blue) hue = 60 * ((red - green) / delta + 4);
  }

  if (hue < 0) hue += 360;

  return {
    h: hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function hsvToHex({ h, s, v }: HsvColor) {
  const chroma = v * s;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = v - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (h < 60) [red, green, blue] = [chroma, secondary, 0];
  else if (h < 120) [red, green, blue] = [secondary, chroma, 0];
  else if (h < 180) [red, green, blue] = [0, chroma, secondary];
  else if (h < 240) [red, green, blue] = [0, secondary, chroma];
  else if (h < 300) [red, green, blue] = [secondary, 0, chroma];
  else [red, green, blue] = [chroma, 0, secondary];

  const toHex = (channel: number) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

export function StatusColorPicker({
  value,
  name,
  error,
  helperText,
  inputRef,
  onChange,
  onBlur,
}: StatusColorPickerProps) {
  const normalizedValue = value?.toUpperCase() || '#';
  const previewColor = isHexColor(normalizedValue) ? normalizedValue : DEFAULT_STATUS_COLOR;
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const [draftColor, setDraftColor] = useState(previewColor);
  const draftHsv = hexToHsv(draftColor);

  const openAdvancedPicker = (target: HTMLElement) => {
    setDraftColor(previewColor);
    setPickerAnchor(target);
  };

  const updateSaturation = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const saturation = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const brightness = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    setDraftColor(
      hsvToHex({
        h: draftHsv.h,
        s: saturation,
        v: brightness,
      }),
    );
  };

  return (
    <div className="grid items-start gap-2 sm:grid-cols-[132px_minmax(0,1fr)]">
      <FormInputField
        name={name}
        label="Màu HEX *"
        value={normalizedValue}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
        onBlur={onBlur}
        onChange={(event) => onChange(normalizeHexDraft(event.target.value))}
        slotProps={{
          htmlInput: {
            maxLength: 7,
            autoComplete: 'off',
            spellCheck: false,
            className: 'font-mono uppercase',
          },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <button
                  type="button"
                  aria-label="Mở bộ chọn màu nâng cao"
                  className="h-5 w-5 cursor-pointer rounded border border-slate-300 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{ backgroundColor: previewColor }}
                  onClick={(event) => openAdvancedPicker(event.currentTarget)}
                />
              </InputAdornment>
            ),
          },
        }}
      />

      <div className="flex min-h-10 items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white px-2">
        {STATUS_COLOR_PRESETS.map((preset) => {
          const selected = preset.color === normalizedValue;

          return (
            <Tooltip key={preset.color} title={`${preset.label} · ${preset.color}`} arrow>
              <button
                type="button"
                aria-label={`Chọn màu ${preset.label} ${preset.color}`}
                aria-pressed={selected}
                className={`inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-2 border-white shadow-sm transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  selected ? 'ring-2 ring-slate-500 ring-offset-1' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: preset.color }}
                onClick={() => onChange(preset.color)}
              >
                {selected ? <CheckRoundedIcon className="!text-[13px] text-white" /> : null}
              </button>
            </Tooltip>
          );
        })}

        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-slate-200" />

        <Tooltip title="Chọn màu nâng cao" arrow>
          <IconButton
            size="small"
            aria-label="Mở bộ chọn màu nâng cao"
            className="!h-7 !w-7 !shrink-0 !rounded-md"
            onClick={(event) => openAdvancedPicker(event.currentTarget)}
          >
            <ColorizeRoundedIcon className="!text-[17px] text-slate-500" />
          </IconButton>
        </Tooltip>
      </div>

      <Popover
        open={Boolean(pickerAnchor)}
        anchorEl={pickerAnchor}
        onClose={() => setPickerAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            className: '!mt-2 !w-[280px] !overflow-hidden !rounded-xl !border !border-slate-200',
          },
        }}
      >
        <div className="p-3">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Độ sáng và độ bão hòa"
            aria-valuetext={draftColor}
            className="relative h-40 cursor-crosshair touch-none overflow-hidden rounded-lg border border-slate-200"
            style={{
              backgroundColor: `hsl(${draftHsv.h} 100% 50%)`,
              backgroundImage:
                'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateSaturation(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) updateSaturation(event);
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 0.1 : 0.02;
              const next = { ...draftHsv };

              if (event.key === 'ArrowLeft') next.s = Math.max(0, next.s - step);
              else if (event.key === 'ArrowRight') next.s = Math.min(1, next.s + step);
              else if (event.key === 'ArrowUp') next.v = Math.min(1, next.v + step);
              else if (event.key === 'ArrowDown') next.v = Math.max(0, next.v - step);
              else return;

              event.preventDefault();
              setDraftColor(hsvToHex(next));
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.55)]"
              style={{ left: `${draftHsv.s * 100}%`, top: `${(1 - draftHsv.v) * 100}%` }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={359}
            value={Math.round(draftHsv.h)}
            aria-label="Sắc độ màu"
            className="mt-3 h-3 w-full cursor-pointer appearance-none rounded-full border border-slate-200"
            style={{
              background:
                'linear-gradient(90deg, #EF4444, #F59E0B, #22C55E, #06B6D4, #3B82F6, #8B5CF6, #EC4899, #EF4444)',
            }}
            onChange={(event) =>
              setDraftColor(hsvToHex({ ...draftHsv, h: Number(event.target.value) }))
            }
          />

          <div className="mt-3 flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-1 h-8 w-8 shrink-0 rounded-md border border-slate-200 shadow-sm"
              style={{
                backgroundColor: isHexColor(draftColor) ? draftColor : DEFAULT_STATUS_COLOR,
              }}
            />
            <FormInputField
              label="Mã HEX"
              value={draftColor}
              error={!isHexColor(draftColor)}
              helperText={!isHexColor(draftColor) ? 'Nhập đủ 6 ký tự HEX' : undefined}
              onChange={(event) => setDraftColor(normalizeHexDraft(event.target.value))}
              slotProps={{
                htmlInput: {
                  maxLength: 7,
                  autoComplete: 'off',
                  spellCheck: false,
                  className: 'font-mono uppercase',
                },
              }}
            />
          </div>

          <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button size="small" color="inherit" onClick={() => setPickerAnchor(null)}>
              Hủy
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={!isHexColor(draftColor)}
              onClick={() => {
                onChange(draftColor.toUpperCase());
                setPickerAnchor(null);
              }}
            >
              Chọn
            </Button>
          </div>
        </div>
      </Popover>
    </div>
  );
}
