'use client';

import Link from 'next/link';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Button, MenuItem, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import type { Customer, CustomerFormValues } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

type CustomerApiFormProps = {
  mode: 'create' | 'edit';
  customer?: Customer | null;
  defaultValues: CustomerFormValues;
  users: User[];
  customerTypes: AppOption[];
  sources: AppOption[];
  isSubmitting: boolean;
  onSubmit: (values: CustomerFormValues) => void;
};

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
      <div className="space-y-5 p-6">{children}</div>
    </section>
  );
}

function CustomerDatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <DatePicker
      label={label}
      value={value ? dayjs(value) : null}
      onChange={(nextValue) => onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM-DD') : '')}
      slotProps={{ textField: { fullWidth: true } }}
    />
  );
}

export function CustomerApiForm({
  mode,
  customer,
  defaultValues,
  users,
  customerTypes,
  sources,
  isSubmitting,
  onSubmit,
}: CustomerApiFormProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({ values: defaultValues });

  return (
    <form className="w-full space-y-8" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <FormSection
            title="Thông tin khách hàng"
            description="Thông tin định danh, liên hệ, pháp lý và ghi chú chăm sóc."
          >
            <input type="hidden" {...register('customerCode')} />
            <input type="hidden" {...register('leadId')} />

            <div className="grid gap-4 md:grid-cols-2 !mt-0">
              <TextField
                fullWidth
                label="Tên khách hàng *"
                placeholder="K.HYUNDAINGOCAN - C.Mai"
                error={Boolean(errors.customerName)}
                helperText={errors.customerName?.message}
                {...register('customerName', { required: 'Vui lòng nhập tên khách hàng' })}
              />
              <TextField fullWidth label="Tên công ty" {...register('companyName')} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField fullWidth label="Người đại diện" {...register('representativeName')} />
              <TextField fullWidth label="Số điện thoại" {...register('phone')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField fullWidth type="email" label="Email" {...register('email')} />
              <TextField fullWidth label="Website" {...register('website')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField fullWidth label="Ngành" {...register('industry')} />
              <TextField fullWidth label="Mã số thuế" {...register('taxCode')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField fullWidth label="CCCD/CMND" {...register('identityNo')} />
              <Controller
                name="birthday"
                control={control}
                render={({ field }) => (
                  <CustomerDatePicker
                    label="Ngày sinh"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <TextField fullWidth multiline minRows={2} label="Địa chỉ" {...register('address')} />

            <TextField
              fullWidth
              multiline
              minRows={5}
              label="Ghi chú"
              placeholder="Nhu cầu, lịch sử trao đổi, lưu ý khi chăm sóc..."
              {...register('note')}
            />
          </FormSection>
        </div>

        <div className="xl:col-span-4">
          <FormSection
            title="Phân loại & phụ trách"
            description="Loại khách hàng, nguồn phát sinh và sales phụ trách."
          >
            {customer?.lead && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-100">
                <p className="font-bold text-slate-950">{customer.lead.customerName}</p>
                <p className="mt-1">Lead: {customer.lead.leadCode || customer.lead.id}</p>
              </div>
            )}

            <Controller
              name="customerTypeOptionId"
              control={control}
              render={({ field }) => (
                <TextField fullWidth select label="Loại khách hàng" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {customerTypes.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="sourceOptionId"
              control={control}
              render={({ field }) => (
                <TextField fullWidth select label="Nguồn phát sinh" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {sources.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="salesUserId"
              control={control}
              render={({ field }) => (
                <TextField fullWidth select label="Nhân sự sales" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name || user.email || user.code}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </FormSection>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-slate-200 bg-white/90 px-1 py-4 backdrop-blur">
        <Link
          href="/customers"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Hủy
        </Link>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          startIcon={<SaveRoundedIcon />}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          {isSubmitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo khách hàng' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}
