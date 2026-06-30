'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROLE_LABELS, formatDate } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

const ROLES = ['ADMIN', 'LEADER', 'EMPLOYEE', 'ACCOUNTANT', 'SALES'];

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const qc = useQueryClient();
  const id = params.id as string;

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/users/${id}`).then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm();

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        phone: user.phone || '',
        role: user.role,
        isActive: String(user.isActive),
      });
    }
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: (data: any) => api.put(`/users/${id}`, {
      ...data,
      isActive: data.isActive === 'true',
    }),
    onSuccess: (res) => {
      qc.setQueryData(['user', id], res.data);
      qc.invalidateQueries({ queryKey: ['users'] });
      reset({
        name: res.data.name,
        phone: res.data.phone || '',
        role: res.data.role,
        isActive: String(res.data.isActive),
      });
    },
  });

  if (isLoading) {
    return (
      <div>
        <Header title="Chi tiết nhân viên" />
        <div className="p-6 text-center text-gray-400">Đang tải...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <Header title="Chi tiết nhân viên" />
        <div className="p-6 text-center text-red-500">Không tìm thấy nhân viên</div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Chi tiết nhân viên" />
      <div className="p-6">
        <Button variant="ghost" className="mb-6 -ml-2 text-gray-600" onClick={() => router.push('/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Quay lại danh sách
        </Button>

        {/* Thông tin cố định */}
        <div className="bg-white rounded-lg border p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Thông tin tài khoản</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Mã nhân viên</p>
              <p className="font-medium">{user.code}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Ngày tạo</p>
              <p className="font-medium">{formatDate(user.createdAt)}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Cập nhật lần cuối</p>
              <p className="font-medium">{formatDate(user.updatedAt)}</p>
            </div>
          </div>
        </div>

        {/* Form chỉnh sửa */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Chỉnh sửa thông tin</h2>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Họ tên *</Label>
              <Input {...register('name', { required: 'Bắt buộc' })} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message as string}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Số điện thoại</Label>
              <Input placeholder="0901234567" {...register('phone')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Vai trò *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('role', { required: true })}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Trạng thái</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('isActive')}
                >
                  <option value="true">Hoạt động</option>
                  <option value="false">Vô hiệu</option>
                </select>
              </div>
            </div>

            {mutation.isError && (
              <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
                {(mutation.error as any)?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'}
              </div>
            )}

            {mutation.isSuccess && (
              <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-600">
                Cập nhật thành công
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/users')}>Hủy</Button>
              <Button type="submit" disabled={mutation.isPending || !isDirty}>
                {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
