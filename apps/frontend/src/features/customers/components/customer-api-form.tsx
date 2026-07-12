'use client';

import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { MenuItem } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { FormActionBar } from '@/components/form/form-action-bar';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
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
  cancelHref?: string;
  isSubmitting: boolean;
  onSubmit: (values: CustomerFormValues) => void;
};

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
      slotProps={{
        textField: {
          fullWidth: true,
          size: 'small',
          className: compactFormFieldClassName,
        },
      }}
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
  cancelHref = '/customers',
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
    <form className="flex w-full flex-1 flex-col" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <FormSection title="Thông tin khách hàng">
            <input type="hidden" {...register('customerCode')} />
            <input type="hidden" {...register('leadId')} />

            <div className="grid gap-4 md:grid-cols-2 !mt-0">
              <FormInputField
                label="Tên khách hàng *"
                placeholder="K.HYUNDAINGOCAN - C.Mai"
                error={Boolean(errors.customerName)}
                helperText={errors.customerName?.message}
                {...register('customerName', { required: 'Vui lòng nhập tên khách hàng' })}
              />
              <FormInputField label="Tên công ty" {...register('companyName')} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField label="Người đại diện" {...register('representativeName')} />
              <FormInputField label="Số điện thoại" {...register('phone')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField type="email" label="Email" {...register('email')} />
              <FormInputField label="Website" {...register('website')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField label="Ngành" {...register('industry')} />
              <FormInputField label="Mã số thuế" {...register('taxCode')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField label="CCCD/CMND" {...register('identityNo')} />
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

            <FormInputField multiline minRows={2} label="Địa chỉ" {...register('address')} />

            <FormInputField
              multiline
              minRows={5}
              label="Ghi chú"
              placeholder="Nhu cầu, lịch sử trao đổi, lưu ý khi chăm sóc..."
              {...register('note')}
            />
          </FormSection>
        </div>

        <div className="xl:col-span-4">
          <FormSection title="Phân loại & phụ trách">
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
                <FormSelectField label="Loại khách hàng" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {customerTypes.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.label}
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />

            <Controller
              name="sourceOptionId"
              control={control}
              render={({ field }) => (
                <FormSelectField label="Nguồn phát sinh" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {sources.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.label}
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />

            <Controller
              name="salesUserId"
              control={control}
              render={({ field }) => (
                <FormSelectField label="Nhân sự sales" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name || user.email || user.code}
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />
          </FormSection>
        </div>
      </div>

      <FormActionBar
        cancelHref={cancelHref}
        submitLabel={mode === 'create' ? 'Tạo khách hàng' : 'Lưu thay đổi'}
        isSubmitting={isSubmitting}
        submitIcon={<SaveRoundedIcon />}
      />
    </form>
  );
}
