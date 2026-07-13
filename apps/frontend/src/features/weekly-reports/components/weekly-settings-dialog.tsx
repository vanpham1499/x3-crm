'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
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
    <Dialog open={open} onClose={isSubmitting ? undefined : closeDialog} maxWidth="sm" fullWidth>
      <DialogTitle className="border-b border-slate-100 px-5 py-4">
        <p className="text-base font-bold text-slate-950">Cấu hình báo cáo tuần dự án</p>
      </DialogTitle>

      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            await onSubmit(values);
            closeDialog();
          } catch (error) {
            applyApiErrorsToForm(error, setError);
          }
        })}
      >
        <DialogContent className="grid gap-3 px-5 py-4 md:grid-cols-2">
          <Controller
            name="reportOwnerUserId"
            control={control}
            render={({ field }) => (
              <TextField
                select
                fullWidth
                label="Người phụ trách báo cáo"
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
              </TextField>
            )}
          />
          <Controller
            name="reportWeekday"
            control={control}
            render={({ field }) => (
              <TextField
                select
                fullWidth
                label="Thứ báo cáo tuần"
                error={Boolean(errors.reportWeekday)}
                helperText={errors.reportWeekday?.message}
                {...field}
              >
                {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="monthlyBudget"
            control={control}
            render={({ field }) => (
              <MoneyInput
                fullWidth
                label="Ngân sách/tháng"
                value={field.value}
                onValueChange={field.onChange}
                error={Boolean(errors.monthlyBudget)}
                helperText={errors.monthlyBudget?.message}
              />
            )}
          />
          <TextField
            fullWidth
            type="number"
            label="% Phí quản lý"
            error={Boolean(errors.managementFeeRate)}
            helperText={errors.managementFeeRate?.message}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            {...register('managementFeeRate')}
          />
          <div className="flex items-center gap-2 md:col-span-2">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
              )}
            />
            <span className="text-sm font-semibold text-slate-700">Đang áp dụng báo cáo tuần</span>
          </div>
        </DialogContent>

        <DialogActions className="border-t border-slate-100 px-5 py-3">
          <Button size="small" variant="outlined" onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            size="small"
            variant="contained"
            disabled={isSubmitting}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
