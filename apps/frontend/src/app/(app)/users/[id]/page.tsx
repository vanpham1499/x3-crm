'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Button, CircularProgress, MenuItem, Paper, TextField } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ROLE_LABELS, formatDate } from '@/lib/utils';
import { api } from '@/services/api/client';

const ROLES = ['ADMIN', 'LEADER', 'EMPLOYEE', 'ACCOUNTANT', 'SALES'];

type UserDetailFormData = {
  name: string;
  phone?: string;
  role: string;
  isActive: string;
};

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const qc = useQueryClient();
  const id = params.id as string;

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/users/${id}`).then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UserDetailFormData>();

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
    mutationFn: (data: UserDetailFormData) =>
      api.put(`/users/${id}`, {
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
      <div className="flex flex-col items-center p-12 text-slate-500">
        <CircularProgress size={28} />
        <p className="mt-4">Đang tải...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Alert severity="error">Không tìm thấy nhân viên</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => router.push('/users')}>
        Quay lại danh sách
      </Button>

      <Paper variant="outlined" className="rounded-lg p-6">
        <p className="mb-4 text-[13px] font-extrabold uppercase text-slate-500">Thông tin tài khoản</p>
        <div className="grid gap-4 md:grid-cols-2">
          <InfoItem label="Mã nhân viên" value={user.code} />
          <InfoItem label="Email" value={user.email} />
          <InfoItem label="Ngày tạo" value={formatDate(user.createdAt)} />
          <InfoItem label="Cập nhật lần cuối" value={formatDate(user.updatedAt)} />
        </div>
      </Paper>

      <Paper variant="outlined" className="rounded-lg p-6">
        <p className="mb-4 text-[13px] font-extrabold uppercase text-slate-500">Chỉnh sửa thông tin</p>

        <form className="space-y-5" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <TextField
            fullWidth
            label="Họ tên *"
            error={Boolean(errors.name)}
            helperText={errors.name?.message as string}
            {...register('name', { required: 'Bắt buộc' })}
          />

          <TextField fullWidth label="Số điện thoại" placeholder="0901234567" {...register('phone')} />

          <div className="grid gap-4 md:grid-cols-2">
            <TextField fullWidth select label="Vai trò *" defaultValue={user.role} {...register('role', { required: true })}>
              {ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </MenuItem>
              ))}
            </TextField>

            <TextField fullWidth select label="Trạng thái" defaultValue={String(user.isActive)} {...register('isActive')}>
              <MenuItem value="true">Hoạt động</MenuItem>
              <MenuItem value="false">Vô hiệu</MenuItem>
            </TextField>
          </div>

          {mutation.isError && (
            <Alert severity="error">
              {(mutation.error as any)?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'}
            </Alert>
          )}

          {mutation.isSuccess && <Alert severity="success">Cập nhật thành công</Alert>}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button variant="outlined" onClick={() => router.push('/users')}>
              Hủy
            </Button>
            <Button type="submit" variant="contained" disabled={mutation.isPending || !isDirty}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </Paper>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[13px] text-slate-500">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
