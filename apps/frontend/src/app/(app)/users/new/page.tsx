'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { UserForm, UserFormValues, getUserFormDefaults } from '@/features/users/components/user-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { api } from '@/services/api/client';
import type { RoleOption } from '@/types/user';

export default function NewUserPage() {
  const router = useRouter();
  const notify = useAppNotification();

  const { data: roles = [] } = useQuery<RoleOption[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((response) => response.data),
  });

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      api.post('/users', {
        code: values.code.trim(),
        password: values.password,
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || undefined,
        avatar: values.avatarUrl || null,
        role: values.role,
      }),
    onSuccess: () => {
      notify.success('Tạo nhân viên thành công');
      router.push('/users');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Tạo nhân viên thất bại'));
    },
  });

  return (
    <UserForm
      mode="create"
      roles={roles}
      defaultValues={getUserFormDefaults()}
      isSubmitting={mutation.isPending}
      onSubmit={(values) => mutation.mutateAsync(values)}
    />
  );
}
