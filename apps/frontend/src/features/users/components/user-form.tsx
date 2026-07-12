'use client';

import { useMemo } from 'react';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Button, MenuItem, Switch } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { FormActionBar } from '@/components/form/form-action-bar';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { ImageUpload } from '@/components/upload/image-upload';
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
  onSubmit: (values: UserFormValues) => void;
  onDelete?: () => void;
};

function getInitial(value: string) {
  return (value || 'X').slice(0, 1).toUpperCase();
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
    watch,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({ defaultValues });

  const displayName = watch('name') || defaultValues.name || defaultValues.code || 'Nhân viên mới';
  const watchedIsActive = watch('isActive');
  const roleOptions = useMemo(() => {
    if (roles.length > 0) return roles;

    return ['ADMIN', 'LEADER', 'EMPLOYEE', 'ACCOUNTANT', 'SALES'].map((name, index) => ({
      id: index + 1,
      name,
    }));
  }, [roles]);

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
      <PageHeader
        title={mode === 'create' ? 'Thêm nhân viên' : displayName}
        currentLabel={mode === 'edit' ? 'Chỉnh sửa' : undefined}
      />

      <form className="flex w-full flex-1 flex-col" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid w-full items-start gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <FormSection title="Thông tin nhân viên">
              <div className="!mt-0 grid gap-4 md:grid-cols-2">
                <FormInputField
                  label="Họ tên *"
                  error={Boolean(errors.name)}
                  helperText={errors.name?.message}
                  {...register('name', { required: 'Vui lòng nhập họ tên' })}
                />
                <FormInputField
                  label="Mã nhân viên *"
                  disabled={mode === 'edit'}
                  error={Boolean(errors.code)}
                  helperText={errors.code?.message}
                  {...register('code', { required: 'Vui lòng nhập mã nhân viên' })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormInputField
                  label="Email *"
                  type="email"
                  disabled={mode === 'edit'}
                  error={Boolean(errors.email)}
                  helperText={errors.email?.message}
                  {...register('email', { required: 'Vui lòng nhập email' })}
                />
                <FormInputField label="Số điện thoại" type="tel" {...register('phone')} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {mode === 'create' ? (
                  <FormInputField
                    label="Mật khẩu *"
                    type="password"
                    error={Boolean(errors.password)}
                    helperText={errors.password?.message}
                    {...register('password', {
                      required: 'Vui lòng nhập mật khẩu',
                      minLength: { value: 6, message: 'Tối thiểu 6 ký tự' },
                    })}
                  />
                ) : (
                  <FormInputField
                    label="Ngày tạo"
                    value={formatDate(user?.createdAt || '')}
                    disabled
                  />
                )}

                <Controller
                  name="role"
                  control={control}
                  rules={{ required: 'Vui lòng chọn vai trò' }}
                  render={({ field }) => (
                    <FormSelectField
                      label="Vai trò *"
                      error={Boolean(errors.role)}
                      helperText={errors.role?.message}
                      {...field}
                    >
                      {roleOptions.map((role) => (
                        <MenuItem key={role.id} value={role.name}>
                          {getUserRoleLabel(role.name)}
                        </MenuItem>
                      ))}
                    </FormSelectField>
                  )}
                />
              </div>
            </FormSection>
          </div>

          <div className="xl:col-span-4">
            <FormSection
              title="Ảnh đại diện & trạng thái"
              action={
                mode === 'edit' ? (
                  <span
                    className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${getUserStatusClass({ isActive: watchedIsActive } as User)}`}
                  >
                    {getUserStatusLabel({ isActive: watchedIsActive } as User)}
                  </span>
                ) : undefined
              }
            >
              <Controller
                name="avatarUrl"
                control={control}
                render={({ field }) => (
                  <ImageUpload
                    value={field.value}
                    alt={displayName}
                    fallbackText={getInitial(displayName)}
                    onChange={field.onChange}
                  />
                )}
              />

              {mode === 'edit' ? (
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                      <span className="text-sm font-bold text-slate-800">Cho phép đăng nhập</span>
                      <Switch
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                    </div>
                  )}
                />
              ) : null}

              {mode === 'edit' && onDelete ? (
                <div className="border-t border-slate-100 pt-4">
                  <Button
                    color="error"
                    size="small"
                    variant="outlined"
                    startIcon={<DeleteRoundedIcon />}
                    disabled={isDeleting}
                    onClick={onDelete}
                    className="!h-9 !rounded-lg !text-[13px] !font-bold"
                  >
                    {isDeleting ? 'Đang xóa...' : 'Xóa nhân viên'}
                  </Button>
                </div>
              ) : null}
            </FormSection>
          </div>
        </div>

        <FormActionBar
          cancelHref="/users"
          submitLabel={mode === 'create' ? 'Tạo nhân viên' : 'Lưu thay đổi'}
          submittingLabel={mode === 'create' ? 'Đang tạo...' : 'Đang lưu...'}
          isSubmitting={isSubmitting}
          submitDisabled={mode === 'edit' && !isDirty}
          submitIcon={<SaveRoundedIcon />}
        />
      </form>
    </div>
  );
}
