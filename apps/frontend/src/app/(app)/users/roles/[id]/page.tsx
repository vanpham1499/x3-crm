'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ErrorState } from '@/components/feedback/error-state';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import {
  RoleForm,
  RoleFormValues,
  getRoleFormDefaults,
} from '@/features/access-control/components/role-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { canDeleteRoles, canEditRoles } from '@/lib/ownership';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { Permission, Role } from '@/types/access-control';

export default function EditRolePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = canEditRoles(currentUser);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: role, isLoading: isRoleLoading } = useQuery<Role>({
    queryKey: ['roles', id],
    queryFn: () => api.get(`/roles/${id}`).then((response) => response.data),
    enabled: Boolean(id),
  });

  const { data: permissions = [], isLoading: isPermissionsLoading } = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: () => api.get('/permissions').then((response) => response.data),
    enabled: canEdit,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: RoleFormValues) => {
      return api
        .put<Role>(`/roles/${id}`, {
          name: values.name,
          description: values.description || null,
          permission_ids: values.permissionIds,
        })
        .then((response) => response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', id] });
      notify.success('Cập nhật vai trò thành công');
      router.push('/users/roles');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật vai trò thất bại'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      notify.success('Xóa vai trò thành công');
      setDeleteDialogOpen(false);
      router.push('/users/roles');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa vai trò thất bại'));
    },
  });

  if (isRoleLoading || isPermissionsLoading || !role) {
    return <ContentLoading label="Đang tải vai trò và danh mục quyền..." />;
  }

  if (!canEdit) {
    return (
      <ErrorState
        compact
        code="403"
        title="Không có quyền chỉnh sửa vai trò"
        description="Bạn cần đồng thời quyền cập nhật vai trò và quyền gán permission."
        primaryHref="/users/roles"
        primaryLabel="Về danh sách vai trò"
        secondaryHref="/dashboard"
        secondaryLabel="Về Dashboard"
      />
    );
  }

  return (
    <>
      <RoleForm
        mode="edit"
        role={role}
        defaultValues={getRoleFormDefaults(role)}
        permissions={permissions}
        isSubmitting={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onSubmit={(values) => updateMutation.mutateAsync(values)}
        onDelete={canDeleteRoles(currentUser) ? () => setDeleteDialogOpen(true) : undefined}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Xóa vai trò?"
        description={`Bạn có chắc muốn xóa vai trò "${role.name}"? Người dùng đang gắn vai trò này có thể bị ảnh hưởng.`}
        confirmText="Xóa vai trò"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
