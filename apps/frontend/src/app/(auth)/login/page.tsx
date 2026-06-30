'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/services/api/client';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError('');
      const res = await api.post('/auth/login', data);
      setAuth(res.data.user, res.data.access_token);
      router.push('/users');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack spacing={1.75} sx={{ mb: 5 }}>
        <Typography variant="h5">Đăng nhập vào tài khoản</Typography>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary' }}
          className="flex items-center gap-2"
        >
          Chưa có tài khoản?{' '}
          <Link
            component="button"
            underline="none"
            sx={{ fontWeight: 700, color: 'secondary.main' }}
          >
            Liên hệ quản trị viên
          </Link>
        </Typography>
      </Stack>

      <Stack component="form" spacing={3} onSubmit={handleSubmit(onSubmit)}>
        <FormControl error={Boolean(errors.email)}>
          <TextField
            label="Địa chỉ email"
            type="email"
            autoComplete="email"
            error={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email && <FormHelperText>{errors.email.message}</FormHelperText>}
        </FormControl>

        <Stack spacing={1.25}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              component={NextLink}
              href="/forgot-password"
              underline="none"
              sx={{ color: 'text.primary', fontWeight: 600, fontSize: 14 }}
            >
              Quên mật khẩu?
            </Link>
          </Box>

          <FormControl error={Boolean(errors.password)}>
            <TextField
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              error={Boolean(errors.password)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              {...register('password')}
            />
            {errors.password && <FormHelperText>{errors.password.message}</FormHelperText>}
          </FormControl>
        </Stack>

        {error && (
          <Box
            sx={{
              borderRadius: 1,
              bgcolor: '#fef2f2',
              px: 2,
              py: 1.5,
              color: '#dc2626',
              fontSize: 14,
            }}
          >
            {error}
          </Box>
        )}

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ height: 48, bgcolor: '#111827', '&:hover': { bgcolor: '#1f2937' } }}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </Stack>
    </>
  );
}
