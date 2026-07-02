'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Button, FormControl, FormHelperText, TextField } from '@mui/material';
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
      <div className="mb-10 space-y-3.5">
        <h2 className="text-xl font-bold leading-[1.5] text-slate-950">Quên mật khẩu?</h2>
        <p className="text-sm text-slate-500">
          Nhập email tài khoản của bạn. Hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu nếu email tồn tại.
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

        {submittedEmail && (
          <Alert severity="success">
            Nếu {submittedEmail} tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email này.
          </Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          size="large"
          className="!h-12 !bg-slate-900 hover:!bg-slate-800"
          fullWidth
        >
          Gửi hướng dẫn
        </Button>

        <div className="flex justify-center">
          <Button component={NextLink} href="/login" startIcon={<ArrowBackRoundedIcon />}>
            Quay lại đăng nhập
          </Button>
        </div>
      </form>
    </>
  );
}
