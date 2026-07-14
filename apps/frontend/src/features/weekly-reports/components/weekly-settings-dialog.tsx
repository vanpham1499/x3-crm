'use client';

import { MenuItem, Switch } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { applyApiErrorsToForm } from '@/lib/api-error';
import type { ProjectWeeklySetting, ProjectWeeklySettingFormValues } from '@/types/weekly-report';
import type { User } from '@/types/user';

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
  7: 'Chủ nhật',
};

function getDefaults(setting?: ProjectWeeklySetting | null): ProjectWeeklySettingFormValues {
  return {
    reportOwnerUserId: setting?.reportOwnerUserId ? String(setting.reportOwnerUserId) : '',
    reportWeekday: setting?.reportWeekday ? String(setting.reportWeekday) : '2',
    monthlyBudget: String(setting?.monthlyBudget ?? ''),
    managementFeeRate: String(setting?.managementFeeRate ?? ''),
    isActive: setting?.isActive ?? true,
  };
}

export function WeeklySettingsDialog({
  open,
  setting,
  users,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  setting?: ProjectWeeklySetting | null;
  users: User[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectWeeklySettingFormValues) => Promise<unknown>;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProjectWeeklySettingFormValues>({
    values: getDefaults(setting),
  });

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <AppFormDialog
      open={open}
      title="Cấu hình báo cáo tuần"
      maxWidth="sm"
      submitting={isSubmitting}
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      actions={
        <>
          <DialogActionButton disabled={isSubmitting} onClick={closeDialog}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
          </DialogActionButton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          name="reportOwnerUserId"
          control={control}
          render={({ field }) => (
            <FormSelectField
              label="Người phụ trách"
              error={Boolean(errors.reportOwnerUserId)}
              helperText={errors.reportOwnerUserId?.message}
              {...field}
            >
              <MenuItem value="">Chưa chọn</MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={String(user.id)}>
                  {user.name}
                </MenuItem>
              ))}
            </FormSelectField>
          )}
        />

        <Controller
          name="reportWeekday"
          control={control}
          render={({ field }) => (
            <FormSelectField
              label="Ngày báo cáo"
              error={Boolean(errors.reportWeekday)}
              helperText={errors.reportWeekday?.message}
              {...field}
            >
              {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </FormSelectField>
          )}
        />

        <Controller
          name="monthlyBudget"
          control={control}
          render={({ field }) => (
            <MoneyInput
              fullWidth
              size="small"
              label="Ngân sách / tháng"
              value={field.value}
              onValueChange={field.onChange}
              error={Boolean(errors.monthlyBudget)}
              helperText={errors.monthlyBudget?.message}
              className={compactFormFieldClassName}
            />
          )}
        />

        <FormInputField
          type="number"
          label="Phí quản lý (%)"
          error={Boolean(errors.managementFeeRate)}
          helperText={errors.managementFeeRate?.message}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          {...register('managementFeeRate')}
        />

        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 md:col-span-2">
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <Switch
                size="small"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
          <span className="text-sm font-semibold text-slate-700">Đang áp dụng báo cáo tuần</span>
        </label>
      </div>
    </AppFormDialog>
  );
}
