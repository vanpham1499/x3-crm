'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Button, FormControl, FormHelperText, Link, Stack, TextField, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    setSubmittedEmail(data.email);
  };

  return (
    <>
      <Stack spacing={1.75} sx={{ mb: 5 }}>
        <Typography variant="h5">Quên mật khẩu?</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nhập email tài khoản của bạn. Hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu nếu email tồn tại.
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

        {submittedEmail && (
          <Alert severity="success">
            Nếu {submittedEmail} tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email này.
          </Alert>
        )}

        <Button type="submit" variant="contained" size="large" sx={{ height: 48, bgcolor: '#111827', '&:hover': { bgcolor: '#1f2937' } }}>
          Gửi hướng dẫn
        </Button>

        <Button component={NextLink} href="/login" startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: 'center' }}>
          Quay lại đăng nhập
        </Button>
      </Stack>
    </>
  );
}
