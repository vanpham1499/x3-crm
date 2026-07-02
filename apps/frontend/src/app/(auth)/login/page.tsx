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
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/services/api/client';
import type { User } from '@/types/user';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type FormData = z.infer<typeof schema>;

type LoginResponseBody = {
  access_token?: string;
  token?: string;
  user?: User;
  data?: {
    access_token?: string;
    token?: string;
    user?: User;
  };
  message?: string;
};

function normalizeLoginResponse(body: LoginResponseBody) {
  const token = body.access_token || body.token || body.data?.access_token || body.data?.token;
  const user = body.user || body.data?.user || null;

  return { token, user };
}

export default function LoginPage() {
  const router = useRouter();
  const { initialized, setAuth, token } = useAuthStore();
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
    if (initialized && token) {
      router.replace('/users');
    }
  }, [initialized, router, token]);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError('');
      const res = await api.post<LoginResponseBody>('/auth/login', data);
      const auth = normalizeLoginResponse(res.data);

      if (!auth.token) {
        throw new Error('LOGIN_TOKEN_MISSING');
      }

      setAuth(auth.user, auth.token);
      router.replace('/users');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (!initialized || token) {
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

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
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
