'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Header } from '@/components/shell/header';
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
      <Box>
        <Header title="Chi tiết nhân viên" />
        <Stack sx={{ p: 6, color: 'text.secondary', alignItems: 'center' }}>
          <CircularProgress size={28} />
          <Typography sx={{ mt: 2 }}>Đang tải...</Typography>
        </Stack>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box>
        <Header title="Chi tiết nhân viên" />
        <Box sx={{ p: 3 }}>
          <Alert severity="error">Không tìm thấy nhân viên</Alert>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Header title="Chi tiết nhân viên" />
      <Stack spacing={3} sx={{ p: 3 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: 'flex-start' }} onClick={() => router.push('/users')}>
          Quay lại danh sách
        </Button>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
          <Typography color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', fontSize: 13, fontWeight: 800 }}>
            Thông tin tài khoản
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            <InfoItem label="Mã nhân viên" value={user.code} />
            <InfoItem label="Email" value={user.email} />
            <InfoItem label="Ngày tạo" value={formatDate(user.createdAt)} />
            <InfoItem label="Cập nhật lần cuối" value={formatDate(user.updatedAt)} />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
          <Typography color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', fontSize: 13, fontWeight: 800 }}>
            Chỉnh sửa thông tin
          </Typography>

          <Stack component="form" spacing={2.5} onSubmit={handleSubmit((data) => mutation.mutate(data))}>
            <TextField
              label="Họ tên *"
              error={Boolean(errors.name)}
              helperText={errors.name?.message as string}
              {...register('name', { required: 'Bắt buộc' })}
            />

            <TextField label="Số điện thoại" placeholder="0901234567" {...register('phone')} />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
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
            </Stack>

            {mutation.isError && (
              <Alert severity="error">
                {(mutation.error as any)?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'}
              </Alert>
            )}

            {mutation.isSuccess && <Alert severity="success">Cập nhật thành công</Alert>}

            <Stack
              direction="row"
              spacing={1.5}
              sx={{ pt: 2, borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end' }}
            >
              <Button variant="outlined" onClick={() => router.push('/users')}>
                Hủy
              </Button>
              <Button type="submit" variant="contained" disabled={mutation.isPending || !isDirty}>
                {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 0.5, fontSize: 13 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
        {value}
      </Typography>
    </Box>
  );
}
