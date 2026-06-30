'use client';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROLE_LABELS } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

const ROLES = ['ADMIN', 'LEADER', 'EMPLOYEE', 'ACCOUNTANT', 'SALES'];

export default function NewUserPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { role: 'EMPLOYEE' },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => router.push('/users'),
  });

  return (
    <div>
      <Header title="Thêm nhân viên" />
      <div className="p-6">
        <Button variant="ghost" className="mb-6 -ml-2 text-gray-600" onClick={() => router.push('/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Quay lại danh sách
        </Button>

        <div className="bg-white rounded-lg border p-6">
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Mã nhân viên *</Label>
                <Input placeholder="NV010" {...register('code', { required: 'Bắt buộc' })} />
                {errors.code && <p className="text-xs text-red-500">{errors.code.message as string}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Mật khẩu *</Label>
                <Input type="password" placeholder="••••••••" {...register('password', { required: 'Bắt buộc', minLength: { value: 6, message: 'Tối thiểu 6 ký tự' } })} />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message as string}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Họ tên *</Label>
              <Input placeholder="Nguyễn Văn A" {...register('name', { required: 'Bắt buộc' })} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message as string}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" placeholder="email@x3crm.com" {...register('email', { required: 'Bắt buộc' })} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message as string}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Số điện thoại</Label>
              <Input placeholder="0901234567" {...register('phone')} />
            </div>

            <div className="space-y-1.5">
              <Label>Vai trò *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('role', { required: true })}
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>

            {mutation.isError && (
              <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
                {(mutation.error as any)?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/users')}>Hủy</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Đang tạo...' : 'Tạo nhân viên'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
