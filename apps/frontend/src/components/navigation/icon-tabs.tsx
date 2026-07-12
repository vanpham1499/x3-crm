'use client';

import type { ReactElement } from 'react';
import { Tab, Tabs } from '@mui/material';

export type IconTabItem = {
  label: string;
  icon: ReactElement;
};

type IconTabsProps = {
  value: number;
  items: IconTabItem[];
  ariaLabel: string;
  onChange: (value: number) => void;
};

export function IconTabs({ value, items, ariaLabel, onChange }: IconTabsProps) {
  return (
    <Tabs
      value={value}
      onChange={(_, nextValue: number) => onChange(nextValue)}
      aria-label={ariaLabel}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      className="border-b border-slate-200 px-4"
      sx={{
        minHeight: 44,
        '& .MuiTabs-list': {
          gap: '4px',
        },
        '& .MuiTab-root': {
          minHeight: 44,
          minWidth: 0,
          maxWidth: 'none',
          flex: '0 0 auto',
          textTransform: 'none',
          fontSize: 14,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          color: 'hsl(var(--muted-foreground))',
        },
        '& .MuiTab-root.Mui-selected': {
          color: 'hsl(var(--primary))',
        },
        '& .MuiTabs-indicator': {
          height: 2,
          borderRadius: '2px 2px 0 0',
          backgroundColor: 'hsl(var(--primary))',
        },
      }}
    >
      {items.map((item) => (
        <Tab
          key={item.label}
          icon={item.icon}
          iconPosition="start"
          label={item.label}
          disableRipple
        />
      ))}
    </Tabs>
  );
}
