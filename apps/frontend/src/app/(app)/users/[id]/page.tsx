'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { UserForm, UserFormValues, getUserFormDefaults } from '@/features/users/components/user-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { api } from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { RoleOption, User } from '@/types/user';

export default function UserDetailPage() {
  const router = useRouter();
  const notify = useAppNotification();
  const params = useParams();
  const queryClient = useQueryClient();
  const { user: authUser, token, setAuth } = useAuthStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const id = params.id as string;

  const { data: roles = [] } = useQuery<RoleOption[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((response) => response.data),
  });

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['user', id],
    queryFn: () => api.get(`/users/${id}`).then((response) => response.data),
  });

  const updateMutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      api.put(`/users/${id}`, {
        name: values.name.trim(),
        phone: values.phone.trim() || null,
        avatar: values.avatarUrl || null,
        role: values.role,
        isActive: values.isActive,
      }),
    onSuccess: (response) => {
      const updatedUser = response.data as User;

      queryClient.setQueryData(['user', id], updatedUser);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (token && authUser?.id === updatedUser.id) {
        setAuth(updatedUser, token);
      }
      notify.success('Cập nhật nhân viên thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật nhân viên thất bại'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify.success('Xóa nhân viên thành công');
      setDeleteDialogOpen(false);
      router.push('/users');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa nhân viên thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  if (!user) {
    return (
      <div className="p-6">
        <Alert severity="error">Không tìm thấy nhân viên</Alert>
      </div>
    );
  }

  return (
    <>
      <UserForm
        mode="edit"
        user={user}
        roles={roles}
        defaultValues={getUserFormDefaults(user)}
        isSubmitting={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onSubmit={(values) => updateMutation.mutateAsync(values)}
        onDelete={() => setDeleteDialogOpen(true)}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Xóa nhân viên?"
        description={`Bạn có chắc muốn xóa nhân viên "${user.name || user.email || user.code}"? Thao tác này sẽ đưa nhân viên ra khỏi danh sách.`}
        confirmText="Xóa nhân viên"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
