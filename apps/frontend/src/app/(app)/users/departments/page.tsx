'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { DepartmentManager } from '@/features/departments/components/department-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Department, DepartmentPayload } from '@/types/department';
import type { User } from '@/types/user';

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const {
    data: departments = [],
    isFetching,
    isLoading,
  } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/departments').then((response) => response.data),
  });

  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['users', 'department-options'],
    queryFn: () => api.get<User[]>('/users').then((response) => response.data),
  });

  const saveMutation = useMutation({
    mutationFn: ({
      payload,
      department,
    }: {
      payload: DepartmentPayload;
      department?: Department;
    }) =>
      department
        ? api
            .put<Department>(`/departments/${department.id}`, payload)
            .then((response) => response.data)
        : api.post<Department>('/departments', payload).then((response) => response.data),
    onSuccess: async (_department, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['departments'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]);
      notify.success(
        variables.department ? 'Cập nhật phòng ban thành công' : 'Thêm phòng ban thành công',
      );
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Lưu phòng ban thất bại')),
  });

  const deleteMutation = useMutation({
    mutationFn: (department: Department) => api.delete(`/departments/${department.id}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['departments'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]);
      notify.success('Xóa phòng ban thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Xóa phòng ban thất bại')),
  });

  if (isLoading || isUsersLoading) return <ContentLoading />;

  return (
    <DepartmentManager
      departments={departments}
      users={users}
      isFetching={isFetching}
      isSubmitting={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      onSubmit={(payload, department) =>
        saveMutation.mutateAsync({ payload, department: department || undefined })
      }
      onDelete={(department) => deleteMutation.mutateAsync(department)}
    />
  );
}
