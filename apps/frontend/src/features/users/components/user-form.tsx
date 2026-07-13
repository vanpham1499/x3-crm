'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Button, MenuItem, Switch, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { ImageUpload } from '@/components/upload/image-upload';
import { applyApiErrorsToForm } from '@/lib/api-error';
import { formatDate } from '@/lib/utils';
import { getUserRoleLabel, getUserStatusClass, getUserStatusLabel } from '@/lib/user-utils';
import type { RoleOption, User } from '@/types/user';

export type UserFormValues = {
  code: string;
  password?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  avatarUrl: string;
};

type UserFormProps = {
  mode: 'create' | 'edit';
  roles: RoleOption[];
  defaultValues: UserFormValues;
  user?: User;
  isSubmitting: boolean;
  isDeleting?: boolean;
  onSubmit: (values: UserFormValues) => Promise<unknown>;
  onDelete?: () => void;
};

function getInitial(value: string) {
  return (value || 'X').slice(0, 1).toUpperCase();
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function getUserFormDefaults(user?: User): UserFormValues {
  return {
    code: user?.code || '',
    password: '',
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'EMPLOYEE',
    isActive: user?.isActive ?? true,
    avatarUrl: user?.avatar || '',
  };
}

export function UserForm({
  mode,
  roles,
  defaultValues,
  user,
  isSubmitting,
  isDeleting = false,
  onSubmit,
  onDelete,
}: UserFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({ defaultValues });

  const submitForm = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      applyApiErrorsToForm(error, setError);
    }
  });

  const displayName = defaultValues.name || defaultValues.code || 'Nhân viên mới';
  const pageTitle = mode === 'create' ? 'Thêm nhân viên' : 'Chỉnh sửa nhân viên';
  const watchedIsActive = watch('isActive');
  const roleOptions = useMemo(() => {
    if (roles.length > 0) return roles;
    return ['ADMIN', 'LEADER', 'EMPLOYEE', 'ACCOUNTANT', 'SALES'].map((name) => ({
      id: name,
      name,
    }));
  }, [roles]);

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">{pageTitle}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Tài khoản</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Người dùng</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">{mode === 'create' ? 'Thêm mới' : displayName}</span>
        </div>
      </div>

      <form
        className={
          mode === 'create'
            ? 'w-full'
            : 'grid w-full items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]'
        }
        onSubmit={submitForm}
      >
        {mode === 'edit' && (
        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex justify-end">
            <span
              className={`rounded-md px-2 py-1 text-xs font-bold ${getUserStatusClass({ isActive: watchedIsActive } as User)}`}
            >
              {getUserStatusLabel({ isActive: watchedIsActive } as User)}
            </span>
          </div>

          <div className="mt-8 flex flex-col items-center text-center">
            <Controller
              name="avatarUrl"
              control={control}
              render={({ field }) => (
                <ImageUpload
                  value={field.value}
                  alt={displayName}
                  fallbackText={getInitial(displayName)}
                  helperText="Hỗ trợ *.jpeg, *.jpg, *.png, *.gif, *.webp, tối đa 3MB"
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="mt-10 space-y-6">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-950">Hoạt động</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Cho phép tài khoản đăng nhập hệ thống
                    </p>
                  </div>
                  <Switch
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                </div>
              )}
            />

            <div className="border-t border-slate-100 pt-5 text-sm text-slate-500">
              <p>
                Mã NV:{' '}
                <span className="font-bold text-slate-950">{defaultValues.code || 'Chưa có'}</span>
              </p>
              {user?.createdAt && (
                <p className="mt-2">
                  Ngày tạo:{' '}
                  <span className="font-bold text-slate-950">{formatDate(user.createdAt)}</span>
                </p>
              )}
            </div>

            {mode === 'edit' && onDelete && (
              <div className="flex justify-center pt-3">
                <Button
                  color="error"
                  variant="contained"
                  startIcon={<DeleteRoundedIcon />}
                  disabled={isDeleting}
                  onClick={onDelete}
                  className="!bg-red-100 !text-red-700 hover:!bg-red-200"
                >
                  {isDeleting ? 'Đang xóa...' : 'Xóa nhân viên'}
                </Button>
              </div>
            )}
          </div>
        </aside>
        )}

        <FormSection
          title="Thông tin nhân viên"
          description="Thông tin tài khoản, liên hệ và vai trò truy cập hệ thống."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              fullWidth
              label="Họ tên *"
              placeholder="Nguyễn Văn A"
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
              {...register('name', { required: 'Bắt buộc' })}
            />

            <TextField
              fullWidth
              label="Email *"
              type="email"
              placeholder="email@x3crm.com"
              disabled={mode === 'edit'}
              error={Boolean(errors.email)}
              helperText={errors.email?.message}
              {...register('email', { required: 'Bắt buộc' })}
            />

            <TextField
              fullWidth
              label="Số điện thoại"
              placeholder="0901234567"
              {...register('phone')}
            />

            <TextField
              fullWidth
              label="Mã nhân viên *"
              placeholder="NV010"
              disabled={mode === 'edit'}
              error={Boolean(errors.code)}
              helperText={errors.code?.message}
              {...register('code', { required: 'Bắt buộc' })}
            />

            {mode === 'create' && (
              <TextField
                fullWidth
                label="Mật khẩu *"
                type="password"
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                {...register('password', {
                  required: 'Bắt buộc',
                  minLength: { value: 6, message: 'Tối thiểu 6 ký tự' },
                })}
              />
            )}

            <TextField
              fullWidth
              select
              label="Vai trò *"
              defaultValue={defaultValues.role}
              {...register('role', { required: true })}
            >
              {roleOptions.map((role) => (
                <MenuItem key={role.id} value={role.name}>
                  {getUserRoleLabel(role.name)}
                </MenuItem>
              ))}
            </TextField>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button component={Link} href="/users" variant="outlined">
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || (mode === 'edit' && !isDirty)}
              startIcon={<SaveRoundedIcon />}
              className="!bg-slate-900 hover:!bg-slate-800 !text-white disabled:!bg-slate-500 disabled:!text-white disabled:!cursor-not-allowed disabled:!opacity-50"
            >
              {isSubmitting
                ? mode === 'create'
                  ? 'Đang tạo...'
                  : 'Đang lưu...'
                : mode === 'create'
                  ? 'Tạo nhân viên'
                  : 'Lưu thay đổi'}
            </Button>
          </div>
        </FormSection>
      </form>
    </div>
  );
}
