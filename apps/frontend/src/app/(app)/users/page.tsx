'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { UserList } from '@/features/users/components/user-list';
import { getApiErrorMessage } from '@/lib/api-error';
import { api } from '@/services/api/client';
import type { RoleOption, User, UserFilters } from '@/types/user';

function getUsersParams(filters: UserFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    role_id: filters.role_id || undefined,
    is_active: filters.is_active || undefined,
  };
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<UserFilters>({
    keyword: '',
    role_id: '',
    is_active: '',
  });

  const { data: roles = [] } = useQuery<RoleOption[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((response) => response.data),
  });

  const {
    data: users = [],
    isFetching,
    isLoading,
  } = useQuery<User[]>({
    queryKey: ['users', filters],
    queryFn: () =>
      api.get('/users', { params: getUsersParams(filters) }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => api.delete(`/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify.success('Xóa nhân viên thành công');
      setDeleteTarget(null);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa nhân viên thất bại'));
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (userIds: number[]) =>
      Promise.all(userIds.map((userId) => api.delete(`/users/${userId}`))),
    onSuccess: (_, userIds) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify.success(`Đã xóa ${userIds.length} nhân viên`);
      setBulkDeleteIds([]);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa nhân viên thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  const isDeleting = deleteMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <>
      <UserList
        users={users}
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
        title="Xóa nhân viên?"
        description={`Bạn có chắc muốn xóa nhân viên "${deleteTarget?.name || deleteTarget?.email || deleteTarget?.code || ''}"? Thao tác này sẽ đưa nhân viên ra khỏi danh sách.`}
        confirmText="Xóa nhân viên"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        title="Xóa nhân viên đã chọn?"
        description={`Bạn có chắc muốn xóa ${bulkDeleteIds.length} nhân viên đã chọn? Thao tác này sẽ đưa các nhân viên này ra khỏi danh sách.`}
        confirmText="Xóa đã chọn"
        loading={bulkDeleteMutation.isPending}
        onClose={() => setBulkDeleteIds([])}
        onConfirm={() => bulkDeleteMutation.mutate(bulkDeleteIds)}
      />
    </>
  );
}
