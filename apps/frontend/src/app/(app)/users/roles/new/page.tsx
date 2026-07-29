'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/feedback/error-state';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import {
  RoleForm,
  RoleFormValues,
  getRoleFormDefaults,
} from '@/features/access-control/components/role-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { canCreateRoles } from '@/lib/ownership';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { Permission, Role } from '@/types/access-control';

export default function CreateRolePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const canCreate = canCreateRoles(currentUser);

  const { data: permissions = [], isLoading: isPermissionsLoading } = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: () => api.get('/permissions').then((response) => response.data),
    enabled: canCreate,
  });

  const createMutation = useMutation({
    mutationFn: async (values: RoleFormValues) => {
      return api
        .post<Role>('/roles', {
          name: values.name,
          description: values.description || null,
          permission_ids: values.permissionIds,
        })
        .then((response) => response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      notify.success('Tạo vai trò thành công');
      router.push('/users/roles');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Tạo vai trò thất bại'));
    },
  });

  if (isPermissionsLoading) return <ContentLoading label="Đang tải danh mục quyền..." />;

  if (!canCreate) {
    return (
      <ErrorState
        compact
        code="403"
        title="Không có quyền tạo vai trò"
        description="Bạn cần đồng thời quyền tạo vai trò và quyền gán permission."
        primaryHref="/users/roles"
        primaryLabel="Về danh sách vai trò"
        secondaryHref="/dashboard"
        secondaryLabel="Về Dashboard"
      />
    );
  }

  return (
    <RoleForm
      mode="create"
      defaultValues={getRoleFormDefaults()}
      permissions={permissions}
      isSubmitting={createMutation.isPending}
      onSubmit={(values) => createMutation.mutateAsync(values)}
    />
  );
}
