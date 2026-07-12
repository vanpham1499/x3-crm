'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import {
  Button,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppSplashScreen } from '@/components/shell/app-splash-screen';
import { getAuthUser, type AuthResponseBody } from '@/lib/auth-response';
import { useAuthStore } from '@/stores/auth-store';
import { api, initializeCsrfProtection } from '@/services/api/client';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { status, setAuth } = useAuthStore();
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

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [router, status]);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError('');
      await initializeCsrfProtection();
      const res = await api.post<AuthResponseBody>('/auth/login', data);
      const user = getAuthUser(res.data);

      if (!user?.id) {
        throw new Error('LOGIN_USER_MISSING');
      }

      setAuth(user);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'checking' || status === 'authenticated') {
    return <AppSplashScreen label="Dang kiem tra dang nhap" />;
  }

  return (
    <>
      <div className="mb-10 space-y-3.5">
        <h2 className="text-xl font-bold leading-[1.5] text-slate-950">Đăng nhập vào tài khoản</h2>
        <p className="flex items-center gap-2 text-sm text-slate-500">
          Chưa có tài khoản?
          <button type="button" className="font-bold text-secondary">
            Liên hệ quản trị viên
          </button>
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <FormControl error={Boolean(errors.email)} fullWidth>
          <TextField
            label="Địa chỉ email"
            type="email"
            autoComplete="email"
            error={Boolean(errors.email)}
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
            {...register('email')}
          />
          {errors.email && <FormHelperText>{errors.email.message}</FormHelperText>}
        </FormControl>

        <div className="space-y-3">
          <div className="flex justify-end">
            <NextLink
              href="/forgot-password"
              className="text-sm font-semibold text-slate-950 hover:underline"
            >
              Quên mật khẩu?
            </NextLink>
          </div>

          <FormControl error={Boolean(errors.password)} fullWidth>
            <TextField
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              error={Boolean(errors.password)}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
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
        </div>

        {(error || status === 'unavailable') && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error || 'Không kết nối được máy chủ. Vui lòng kiểm tra backend rồi thử lại.'}
          </div>
        )}

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          className="!h-12 !bg-slate-900 hover:!bg-slate-800 !text-white"
          fullWidth
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </form>
    </>
  );
}
