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
import { applyApiErrorsToForm } from '@/lib/api-error';
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
  /** True when the current user has no edit permission on this record — every field is disabled. */
  readOnly?: boolean;
  onSubmit: (values: CustomerFormValues) => Promise<unknown>;
};

function CustomerDatePicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <DatePicker
      label={label}
      value={value ? dayjs(value) : null}
      onChange={(nextValue) => onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM-DD') : '')}
      disabled={disabled}
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
  readOnly = false,
  onSubmit,
}: CustomerApiFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CustomerFormValues>({ values: defaultValues });

  const submitForm = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      applyApiErrorsToForm(error, setError);
    }
  });

  return (
    <form className="flex w-full flex-1 flex-col" onSubmit={submitForm}>
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <FormSection title="Thông tin khách hàng">
            <input type="hidden" {...register('leadId')} />

            <div className="grid gap-4 md:grid-cols-2 !mt-0">
              <FormInputField
                label="Tên khách hàng *"
                placeholder="K.HYUNDAINGOCAN - C.Mai"
                disabled={readOnly}
                error={Boolean(errors.customerName)}
                helperText={errors.customerName?.message}
                {...register('customerName', { required: 'Vui lòng nhập tên khách hàng' })}
              />
              <FormInputField label="Tên công ty" disabled={readOnly} {...register('companyName')} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField
                label="Người đại diện"
                disabled={readOnly}
                {...register('representativeName')}
              />
              <FormInputField label="Số điện thoại" disabled={readOnly} {...register('phone')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField type="email" label="Email" disabled={readOnly} {...register('email')} />
              <FormInputField label="Website" disabled={readOnly} {...register('website')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField label="Ngành" disabled={readOnly} {...register('industry')} />
              <FormInputField label="Mã số thuế" disabled={readOnly} {...register('taxCode')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField label="CCCD/CMND" disabled={readOnly} {...register('identityNo')} />
              <Controller
                name="birthday"
                control={control}
                render={({ field }) => (
                  <CustomerDatePicker
                    label="Ngày sinh"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={readOnly}
                  />
                )}
              />
            </div>

            <FormInputField
              multiline
              minRows={2}
              label="Địa chỉ"
              disabled={readOnly}
              {...register('address')}
            />

            <FormInputField
              multiline
              minRows={5}
              label="Ghi chú"
              placeholder="Nhu cầu, lịch sử trao đổi, lưu ý khi chăm sóc..."
              disabled={readOnly}
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
                <FormSelectField label="Loại khách hàng" disabled={readOnly} {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {customerTypes.map((option) => (
                    <MenuItem key={option.id} value={String(option.id)}>
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
                <FormSelectField label="Nguồn phát sinh" disabled={readOnly} {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {sources.map((option) => (
                    <MenuItem key={option.id} value={String(option.id)}>
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
                <FormSelectField label="Nhân sự sales" disabled={readOnly} {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={String(user.id)}>
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
        submitDisabled={readOnly}
        submitIcon={<SaveRoundedIcon />}
      />
    </form>
  );
}
