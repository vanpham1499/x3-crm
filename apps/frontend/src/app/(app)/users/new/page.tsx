'use client';

import { useRouter } from 'next/navigation';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Header } from '@/components/shell/header';
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
    <Box>
      <Header title="Thêm nhân viên" />
      <Stack spacing={3} sx={{ p: 3 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: 'flex-start' }} onClick={() => router.push('/users')}>
          Quay lại danh sách
        </Button>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
          <Stack component="form" spacing={2.5} onSubmit={handleSubmit((data) => mutation.mutate(data))}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
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
            </Stack>

            <TextField
              label="Họ tên *"
              placeholder="Nguyễn Văn A"
              error={Boolean(errors.name)}
              helperText={errors.name?.message as string}
              {...register('name', { required: 'Bắt buộc' })}
            />

            <TextField
              label="Email *"
              type="email"
              placeholder="email@x3crm.com"
              error={Boolean(errors.email)}
              helperText={errors.email?.message as string}
              {...register('email', { required: 'Bắt buộc' })}
            />

            <TextField label="Số điện thoại" placeholder="0901234567" {...register('phone')} />

            <TextField select label="Vai trò *" defaultValue="EMPLOYEE" {...register('role', { required: true })}>
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

            <Stack
              direction="row"
              spacing={1.5}
              sx={{ pt: 2, borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end' }}
            >
              <Button variant="outlined" onClick={() => router.push('/users')}>
                Hủy
              </Button>
              <Button type="submit" variant="contained" disabled={mutation.isPending}>
                {mutation.isPending ? 'Đang tạo...' : 'Tạo nhân viên'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
