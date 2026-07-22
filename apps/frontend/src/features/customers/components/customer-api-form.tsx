'use client';

import { useState } from 'react';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { MenuItem } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { FormActionBar } from '@/components/form/form-action-bar';
import { ExternalLinkAdornment } from '@/components/form/external-link-adornment';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { MultiImageUpload } from '@/components/upload/multi-image-upload';
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
  const [isUploadingIdentityImages, setIsUploadingIdentityImages] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<CustomerFormValues>({ values: defaultValues });
  const websiteValue = watch('website');

  const submitForm = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      applyApiErrorsToForm(error, setError);
    }
  });

  return (
    <form noValidate className="flex w-full flex-1 flex-col" onSubmit={submitForm}>
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <FormSection title="Thông tin khách hàng">
            <input type="hidden" {...register('leadId')} />

            <div className="grid gap-4 md:grid-cols-12 !mt-0">
              <div className="md:col-span-3">
                <FormInputField
                  label={mode === 'edit' ? 'Mã khách hàng *' : 'Mã khách hàng'}
                  placeholder="Tự động nếu để trống"
                  disabled={readOnly}
                  error={Boolean(errors.customerCode)}
                  helperText={errors.customerCode?.message}
                  {...register('customerCode', {
                    validate: (value) =>
                      mode === 'create' || value.trim() !== '' || 'Vui lòng nhập mã khách hàng',
                    maxLength: {
                      value: 50,
                      message: 'Mã khách hàng không được vượt quá 50 ký tự',
                    },
                  })}
                />
              </div>
              <div className="md:col-span-4">
                <FormInputField
                  label="Tên khách hàng *"
                  placeholder="K.HYUNDAINGOCAN - C.Mai"
                  disabled={readOnly}
                  error={Boolean(errors.customerName)}
                  helperText={errors.customerName?.message}
                  {...register('customerName', { required: 'Vui lòng nhập tên khách hàng' })}
                />
              </div>
              <div className="md:col-span-5">
                <FormInputField
                  required
                  label="Tên công ty / cá nhân"
                  disabled={readOnly}
                  error={Boolean(errors.companyName)}
                  helperText={errors.companyName?.message}
                  {...register('companyName', {
                    validate: (value) =>
                      value.trim() !== '' || 'Vui lòng nhập tên công ty / cá nhân',
                  })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField
                required
                label="Người đại diện"
                disabled={readOnly}
                error={Boolean(errors.representativeName)}
                helperText={errors.representativeName?.message}
                {...register('representativeName', {
                  validate: (value) => value.trim() !== '' || 'Vui lòng nhập người đại diện',
                })}
              />
              <FormInputField
                required
                label="Số điện thoại"
                disabled={readOnly}
                error={Boolean(errors.phone)}
                helperText={errors.phone?.message}
                {...register('phone', {
                  validate: (value) => value.trim() !== '' || 'Vui lòng nhập số điện thoại',
                })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField
                type="email"
                label="Email"
                disabled={readOnly}
                {...register('email')}
              />
              <FormInputField
                required
                type="email"
                label="Email nhận hóa đơn"
                disabled={readOnly}
                error={Boolean(errors.invoiceEmail)}
                helperText={errors.invoiceEmail?.message}
                {...register('invoiceEmail', {
                  validate: (value) => value.trim() !== '' || 'Vui lòng nhập email nhận hóa đơn',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Email nhận hóa đơn không hợp lệ',
                  },
                })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField
                label="Website"
                disabled={readOnly}
                slotProps={{
                  input: {
                    endAdornment: (
                      <ExternalLinkAdornment
                        value={websiteValue}
                        ariaLabel="Mở Website trong tab mới"
                      />
                    ),
                  },
                }}
                {...register('website')}
              />
              <FormInputField label="Ngành" disabled={readOnly} {...register('industry')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField
                required
                label="CCCD / MST"
                disabled={readOnly}
                error={Boolean(errors.taxCode)}
                helperText={errors.taxCode?.message}
                {...register('taxCode', {
                  validate: (value) => value.trim() !== '' || 'Vui lòng nhập CCCD / MST',
                })}
              />
              <input type="hidden" {...register('identityNo')} />
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

            <div className="grid items-start gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <FormInputField
                  required
                  multiline
                  minRows={2}
                  label="Địa chỉ"
                  disabled={readOnly}
                  error={Boolean(errors.address)}
                  helperText={errors.address?.message}
                  {...register('address', {
                    validate: (value) => value.trim() !== '' || 'Vui lòng nhập địa chỉ',
                  })}
                />

                <FormInputField
                  multiline
                  minRows={5}
                  label="Ghi chú"
                  placeholder="Nhu cầu, lịch sử trao đổi, lưu ý khi chăm sóc..."
                  disabled={readOnly}
                  {...register('note')}
                />
              </div>

              <Controller
                name="identityImageUrls"
                control={control}
                render={({ field }) => (
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-700">Ảnh CCCD</p>
                    <MultiImageUpload
                      value={field.value || []}
                      disabled={readOnly}
                      onChange={field.onChange}
                      onUploadingChange={setIsUploadingIdentityImages}
                    />
                  </div>
                )}
              />
            </div>
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
              rules={{ required: 'Vui lòng chọn loại khách hàng' }}
              render={({ field }) => (
                <FormSelectField
                  required
                  label="Loại khách hàng"
                  disabled={readOnly}
                  error={Boolean(errors.customerTypeOptionId)}
                  helperText={errors.customerTypeOptionId?.message}
                  {...field}
                >
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
              rules={{
                required: 'Lead chưa có nguồn phát sinh. Vui lòng cập nhật Lead trước',
              }}
              render={({ field }) => (
                <FormSelectField
                  required
                  label="Nguồn phát sinh"
                  disabled
                  error={Boolean(errors.sourceOptionId)}
                  helperText={errors.sourceOptionId?.message}
                  {...field}
                >
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
              rules={{ required: 'Vui lòng chọn nhân sự phụ trách' }}
              render={({ field }) => (
                <FormSelectField
                  required
                  label="Nhân sự phụ trách"
                  disabled={readOnly}
                  error={Boolean(errors.salesUserId)}
                  helperText={errors.salesUserId?.message}
                  {...field}
                >
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
        isSubmitting={isSubmitting || isUploadingIdentityImages}
        submitDisabled={readOnly || isUploadingIdentityImages}
        submitIcon={<SaveRoundedIcon />}
      />
    </form>
  );
}
