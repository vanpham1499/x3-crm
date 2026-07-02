'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { RoleList } from '@/features/access-control/components/role-list';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Role, RoleFilters } from '@/types/access-control';

function getRoleParams(filters: RoleFilters) {
  return {
    keyword: filters.keyword || undefined,
  };
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<RoleFilters>({ keyword: '' });

  const { data: roles = [], isFetching, isLoading } = useQuery<Role[]>({
    queryKey: ['roles', filters],
    queryFn: () => api.get('/roles', { params: getRoleParams(filters) }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (role: Role) => api.delete(`/roles/${role.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      notify.success('Xóa vai trò thành công');
      setDeleteTarget(null);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa vai trò thất bại'));
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (roleIds: string[]) => Promise.all(roleIds.map((roleId) => api.delete(`/roles/${roleId}`))),
    onSuccess: (_, roleIds) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      notify.success(`Đã xóa ${roleIds.length} vai trò`);
      setBulkDeleteIds([]);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa vai trò thất bại'));
    },
  });

  if (isLoading) return <ContentLoading label="Đang tải vai trò..." />;

  const isDeleting = deleteMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <>
      <RoleList
        roles={roles}
        filters={filters}
        isFetching={isFetching}
        onFiltersChange={setFilters}
        isDeleting={isDeleting}
        onDelete={setDeleteTarget}
        onBulkDelete={setBulkDeleteIds}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa vai trò?"
        description={`Bạn có chắc muốn xóa vai trò "${deleteTarget?.name || ''}"? Người dùng đang gắn vai trò này có thể bị ảnh hưởng.`}
        confirmText="Xóa vai trò"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        title="Xóa vai trò đã chọn?"
        description={`Bạn có chắc muốn xóa ${bulkDeleteIds.length} vai trò đã chọn? Người dùng đang gắn các vai trò này có thể bị ảnh hưởng.`}
        confirmText="Xóa đã chọn"
        loading={bulkDeleteMutation.isPending}
        onClose={() => setBulkDeleteIds([])}
        onConfirm={() => bulkDeleteMutation.mutate(bulkDeleteIds)}
      />
    </>
  );
}
