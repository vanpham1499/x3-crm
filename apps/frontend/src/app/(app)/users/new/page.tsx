'use client';

import { useRouter } from 'next/navigation';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Button, MenuItem, Paper, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ROLE_LABELS } from '@/lib/utils';
import { api } from '@/services/api/client';

const ROLES = ['ADMIN', 'LEADER', 'EMPLOYEE', 'ACCOUNTANT', 'SALES'];

type NewUserFormData = {
  code: string;
  password: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
};

export default function NewUserPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewUserFormData>({
    defaultValues: { role: 'EMPLOYEE' },
  });

  const mutation = useMutation({
    mutationFn: (data: NewUserFormData) => api.post('/users', data),
    onSuccess: () => router.push('/users'),
  });

  return (
    <div className="space-y-6 p-6">
      <Button startIcon={<ArrowBackRoundedIcon />} className="self-start" onClick={() => router.push('/users')}>
        Quay lại danh sách
      </Button>

      <Paper variant="outlined" className="rounded-lg p-6">
        <form className="space-y-5" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              fullWidth
              label="Mã nhân viên *"
              placeholder="NV010"
              error={Boolean(errors.code)}
              helperText={errors.code?.message as string}
              {...register('code', { required: 'Bắt buộc' })}
            />
            <TextField
              fullWidth
              label="Mật khẩu *"
              type="password"
              error={Boolean(errors.password)}
              helperText={errors.password?.message as string}
              {...register('password', {
                required: 'Bắt buộc',
                minLength: { value: 6, message: 'Tối thiểu 6 ký tự' },
              })}
            />
          </div>

          <TextField
            fullWidth
            label="Họ tên *"
            placeholder="Nguyễn Văn A"
            error={Boolean(errors.name)}
            helperText={errors.name?.message as string}
            {...register('name', { required: 'Bắt buộc' })}
          />

          <TextField
            fullWidth
            label="Email *"
            type="email"
            placeholder="email@x3crm.com"
            error={Boolean(errors.email)}
            helperText={errors.email?.message as string}
            {...register('email', { required: 'Bắt buộc' })}
          />

          <TextField fullWidth label="Số điện thoại" placeholder="0901234567" {...register('phone')} />

          <TextField fullWidth select label="Vai trò *" defaultValue="EMPLOYEE" {...register('role', { required: true })}>
            {ROLES.map((role) => (
              <MenuItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </MenuItem>
            ))}
          </TextField>

          {mutation.isError && (
            <Alert severity="error">
              {(mutation.error as any)?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'}
            </Alert>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button variant="outlined" onClick={() => router.push('/users')}>
              Hủy
            </Button>
            <Button type="submit" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo nhân viên'}
            </Button>
          </div>
        </form>
      </Paper>
    </div>
  );
}
