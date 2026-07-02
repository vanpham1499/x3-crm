'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ContentLoading } from '@/components/shell/content-loading';
import { PermissionList } from '@/features/access-control/components/permission-list';
import api from '@/services/api/client';
import type { Permission, PermissionFilters } from '@/types/access-control';

function getPermissionParams(filters: PermissionFilters) {
  return {
    keyword: filters.keyword || undefined,
    module: filters.module || undefined,
  };
}

export default function PermissionsPage() {
  const [filters, setFilters] = useState<PermissionFilters>({ keyword: '', module: '' });

  const { data: permissions = [], isFetching, isLoading } = useQuery<Permission[]>({
    queryKey: ['permissions', filters],
    queryFn: () =>
      api.get('/permissions', { params: getPermissionParams(filters) }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const { data: allPermissions = [] } = useQuery<Permission[]>({
    queryKey: ['permissions', 'modules'],
    queryFn: () => api.get('/permissions').then((response) => response.data),
  });

  if (isLoading) return <ContentLoading label="Đang tải phân quyền..." />;

  return (
    <PermissionList
      permissions={permissions}
      moduleOptions={allPermissions.length > 0 ? allPermissions : permissions}
      filters={filters}
      isFetching={isFetching}
      onFiltersChange={setFilters}
    />
  );
}
