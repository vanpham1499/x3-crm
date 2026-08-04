'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Avatar, Button, CircularProgress } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { FormInputField } from '@/components/form/form-input-field';
import { UtilityDrawer } from '@/components/shell/utility-drawer';
import { ImageUpload } from '@/components/upload/image-upload';
import {
  changeCurrentPassword,
  updateCurrentProfile,
  type ChangeCurrentPasswordPayload,
  type UpdateCurrentProfilePayload,
} from '@/features/profile/api';
import { applyApiErrorsToForm, getApiErrorMessage } from '@/lib/api-error';
import { getAuthUser } from '@/lib/auth-response';
import { getMediaPreviewUrl } from '@/lib/media-url';
import {
  getUserRoleClass,
  getUserRoleLabel,
  getUserStatusClass,
  getUserStatusLabel,
} from '@/lib/user-utils';
import { useAuthStore } from '@/stores/auth-store';

type ProfileCenterProps = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
};

type ProfileFormValues = UpdateCurrentProfilePayload;

type PasswordFormValues = ChangeCurrentPasswordPayload & {
  confirmPassword: string;
};

const emptyProfile: ProfileFormValues = {
  name: '',
  phone: '',
  avatar: '',
};

const emptyPassword: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export function ProfileCenter({ open, onToggle, onClose }: ProfileCenterProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const { user, setAuth, logout } = useAuthStore();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const displayName = user?.name || user?.email || user?.code || 'X3Sales';
  const displayInitial = displayName.trim().charAt(0).toUpperCase() || 'X';
  const avatarUrl = getMediaPreviewUrl(user?.avatar);

  const profileForm = useForm<ProfileFormValues>({ defaultValues: emptyProfile });
  const passwordForm = useForm<PasswordFormValues>({ defaultValues: emptyPassword });
  const watchedName = profileForm.watch('name') || displayName;

  useEffect(() => {
    if (!open || !user) return;

    profileForm.reset({
      name: user.name || '',
      phone: user.phone || '',
      avatar: user.avatar || '',
    });
    passwordForm.reset(emptyPassword);
    setShowPasswordForm(false);
  }, [open, passwordForm, profileForm, user]);

  const profileMutation = useMutation({ mutationFn: updateCurrentProfile });
  const passwordMutation = useMutation({ mutationFn: changeCurrentPassword });

  const submitProfile = profileForm.handleSubmit(async (values) => {
    try {
      const response = await profileMutation.mutateAsync(values);
      const nextUser = getAuthUser(response);

      if (nextUser) {
        setAuth(nextUser);
        profileForm.reset({
          name: nextUser.name || '',
          phone: nextUser.phone || '',
          avatar: nextUser.avatar || '',
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
      notify.success('Đã cập nhật thông tin cá nhân');
    } catch (error) {
      const hasFieldErrors = applyApiErrorsToForm(error, profileForm.setError);
      if (!hasFieldErrors) notify.error(getApiErrorMessage(error, 'Không thể cập nhật hồ sơ'));
    }
  });

  const submitPassword = passwordForm.handleSubmit(async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      passwordForm.setError('confirmPassword', {
        type: 'validate',
        message: 'Mật khẩu nhập lại chưa khớp',
      });
      return;
    }

    try {
      await passwordMutation.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      passwordForm.reset(emptyPassword);
      setShowPasswordForm(false);
      notify.success('Đổi mật khẩu thành công');
    } catch (error) {
      const hasFieldErrors = applyApiErrorsToForm(error, passwordForm.setError);
      if (!hasFieldErrors) notify.error(getApiErrorMessage(error, 'Không thể đổi mật khẩu'));
    }
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } catch {
      notify.error('Không thể đăng xuất vì máy chủ đang không phản hồi');
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <button
        type="button"
        title={`${displayName} - ${getUserRoleLabel(user?.role || '')}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-label="Mở thông tin tài khoản"
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          open
            ? 'bg-emerald-50 ring-1 ring-primary/20 dark:bg-emerald-950/40'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Avatar
          src={avatarUrl || undefined}
          alt={displayName}
          className="!h-8 !w-8 !bg-primary !text-sm !font-bold !text-white"
        >
          {displayInitial}
        </Avatar>
      </button>

      <UtilityDrawer open={open} onClose={onClose} title="Tài khoản">
        <div className="sidebar-scrollbar h-full overflow-y-auto overscroll-contain">
          <div className="border-b border-slate-100 bg-gradient-to-b from-emerald-50/80 to-white px-5 pb-6 pt-7 text-center dark:border-slate-800 dark:from-emerald-950/30 dark:to-slate-950">
            <Controller
              name="avatar"
              control={profileForm.control}
              render={({ field }) => (
                <ImageUpload
                  value={field.value}
                  alt={watchedName}
                  fallbackText={(watchedName || 'X').charAt(0).toUpperCase()}
                  helperText=""
                  previewClassName="!h-24 !w-24 !border-solid !border-primary/40 !bg-white !p-1 shadow-md"
                  onUploadingChange={setIsUploadingAvatar}
                  onChange={(url) => field.onChange(url)}
                />
              )}
            />
            <h3 className="mt-4 truncate text-lg font-extrabold text-slate-950 dark:text-white">
              {watchedName}
            </h3>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
              {user?.email || '-'}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span
                className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${getUserRoleClass(user?.role || '')}`}
              >
                {getUserRoleLabel(user?.role || '')}
              </span>
              {user ? (
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${getUserStatusClass(user)}`}
                >
                  {getUserStatusLabel(user)}
                </span>
              ) : null}
            </div>
          </div>

          <form
            noValidate
            onSubmit={submitProfile}
            className="border-b border-slate-100 p-5 dark:border-slate-800"
          >
            <div className="mb-4 flex items-center gap-2">
              <BadgeRoundedIcon className="text-primary" fontSize="small" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Thông tin cá nhân
              </h3>
            </div>

            <div className="space-y-4">
              <FormInputField
                label="Họ và tên *"
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(profileForm.formState.errors.name)}
                helperText={profileForm.formState.errors.name?.message}
                {...profileForm.register('name', { required: 'Vui lòng nhập họ và tên' })}
              />
              <FormInputField
                label="Mã nhân viên"
                value={user?.code || ''}
                disabled
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormInputField
                label="Email"
                value={user?.email || ''}
                disabled
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormInputField
                label="Số điện thoại"
                type="tel"
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(profileForm.formState.errors.phone)}
                helperText={profileForm.formState.errors.phone?.message}
                {...profileForm.register('phone')}
              />
            </div>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              startIcon={
                profileMutation.isPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SaveRoundedIcon />
                )
              }
              disabled={
                profileMutation.isPending || isUploadingAvatar || !profileForm.formState.isDirty
              }
              className="!mt-5 !h-11 !rounded-xl !font-bold"
            >
              {profileMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </form>

          <section className="border-b border-slate-100 p-5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowPasswordForm((current) => !current)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 text-left transition hover:border-primary/40 hover:bg-primary/5 dark:border-slate-700"
              aria-expanded={showPasswordForm}
            >
              <span className="flex items-center gap-3">
                <LockResetRoundedIcon className="text-slate-500" fontSize="small" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Đổi mật khẩu
                </span>
              </span>
              <span className="text-xs font-bold text-primary">
                {showPasswordForm ? 'Thu gọn' : 'Chỉnh sửa'}
              </span>
            </button>

            {showPasswordForm ? (
              <form noValidate onSubmit={submitPassword} className="mt-4 space-y-4">
                <FormInputField
                  label="Mật khẩu hiện tại *"
                  type="password"
                  autoComplete="current-password"
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={Boolean(passwordForm.formState.errors.currentPassword)}
                  helperText={passwordForm.formState.errors.currentPassword?.message}
                  {...passwordForm.register('currentPassword', {
                    required: 'Vui lòng nhập mật khẩu hiện tại',
                  })}
                />
                <FormInputField
                  label="Mật khẩu mới *"
                  type="password"
                  autoComplete="new-password"
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={Boolean(passwordForm.formState.errors.newPassword)}
                  helperText={passwordForm.formState.errors.newPassword?.message}
                  {...passwordForm.register('newPassword', {
                    required: 'Vui lòng nhập mật khẩu mới',
                    minLength: { value: 6, message: 'Mật khẩu phải có tối thiểu 6 ký tự' },
                  })}
                />
                <FormInputField
                  label="Nhập lại mật khẩu mới *"
                  type="password"
                  autoComplete="new-password"
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={Boolean(passwordForm.formState.errors.confirmPassword)}
                  helperText={passwordForm.formState.errors.confirmPassword?.message}
                  {...passwordForm.register('confirmPassword', {
                    required: 'Vui lòng nhập lại mật khẩu mới',
                  })}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="outlined"
                  disabled={passwordMutation.isPending}
                  className="!h-11 !rounded-xl !font-bold"
                >
                  {passwordMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </Button>
              </form>
            ) : null}
          </section>

          <div className="p-5">
            <Button
              fullWidth
              color="error"
              variant="outlined"
              startIcon={<LogoutRoundedIcon />}
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              className="!h-11 !rounded-xl !border-rose-200 !bg-rose-50 !font-bold hover:!bg-rose-100"
            >
              {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </Button>
          </div>
        </div>
      </UtilityDrawer>
    </>
  );
}
