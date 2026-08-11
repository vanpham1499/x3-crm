import type { ComponentPropsWithoutRef } from 'react';

type ListFilterBarProps = ComponentPropsWithoutRef<'div'>;

export function ListFilterBar({ className = '', ...props }: ListFilterBarProps) {
  return (
    <div
      className={`flex flex-col gap-3 [&>*]:w-full sm:flex-row sm:flex-wrap sm:items-center sm:[&>*]:!w-[210px] sm:[&>*]:!flex-none sm:[&>[data-list-filter-search]]:!min-w-[220px] sm:[&>[data-list-filter-search]]:!w-auto sm:[&>[data-list-filter-search]]:!flex-1 sm:[&>[data-list-filter-action]]:!ml-auto sm:[&>[data-list-filter-action]]:!w-auto ${className}`}
      {...props}
    />
  );
}
