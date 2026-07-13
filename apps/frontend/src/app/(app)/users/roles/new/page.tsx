'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { RoleForm, RoleFormValues, getRoleFormDefaults } from '@/features/access-control/components/role-form';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Permission, Role } from '@/types/access-control';

export default function CreateRolePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: () => api.get('/permissions').then((response) => response.data),
  });

  const createMutation = useMutation({
    mutationFn: async (values: RoleFormValues) => {
      const response = await api.post<Role>('/roles', {
        name: values.name,
        description: values.description || null,
      });

      if (values.permissionIds.length > 0) {
        await api.post(`/roles/${response.data.id}/permissions`, {
          permission_ids: values.permissionIds,
        });
      }

      return response.data;
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
