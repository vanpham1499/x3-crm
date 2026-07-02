'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, Button, Checkbox, MenuItem, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import customers from '@/data/customers.json';
import {
  buildCustomerPayload,
  createEmptyCustomerFormValues,
  getUniqueCustomerOptions,
} from '@/lib/customer-form-utils';
import { CUSTOMER_STATUS_TABS } from '@/lib/customer-utils';
import type { Customer, CustomerFormValues, CustomerPayload } from '@/types/customer';

const customerRows = customers as Customer[];
const emptyCheckboxIcon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedCheckboxIcon = <CheckBoxIcon fontSize="small" />;

type CustomerFormMode = 'create' | 'edit';

type CustomerFormProps = {
  mode: CustomerFormMode;
  defaultValues?: CustomerFormValues;
  leadCode?: string;
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
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <KeyboardArrowDownRoundedIcon />
        </button>
      </div>
      <div className="space-y-6 p-6">{children}</div>
    </section>
  );
}

function MultiSelectField({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  return (
    <Autocomplete
      multiple
      freeSolo
      disableCloseOnSelect
      options={options}
      value={value}
      onChange={(_, nextValue) => onChange(nextValue.map((item) => String(item)))}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox icon={emptyCheckboxIcon} checkedIcon={checkedCheckboxIcon} checked={selected} className="mr-2" />
          {option}
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? '' : placeholder} />}
    />
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

export function CustomerForm({ mode, defaultValues, leadCode }: CustomerFormProps) {
  const [savedPayload, setSavedPayload] = useState<CustomerPayload | null>(null);
  const formDefaults = defaultValues ?? createEmptyCustomerFormValues();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({ defaultValues: formDefaults });

  const optionGroups = useMemo(
    () => ({
      owners: getUniqueCustomerOptions(customerRows, 'owner'),
      sources: getUniqueCustomerOptions(customerRows, 'source'),
      services: getUniqueCustomerOptions(customerRows, 'service'),
    }),
    [],
  );

  const onSubmit = async (values: CustomerFormValues) => {
    const payload = buildCustomerPayload(values, leadCode);

    // TODO: Replace this mock with API calls when backend endpoints are ready.
    // create: await api.post('/customers', payload)
    // edit: await api.put(`/customers/${leadCode}`, payload)
    console.info(mode === 'create' ? 'Create customer payload' : 'Update customer payload', payload);
    setSavedPayload(payload);
  };

  return (
    <form className="w-full space-y-8" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <FormSection title="Thông tin khách hàng" description="Thông tin liên hệ, trạng thái và thời gian chăm sóc.">
            <TextField
              fullWidth
              label="Tên khách hàng *"
              placeholder="VD: ABC Spa - C.Linh"
              error={Boolean(errors.customerCode)}
              helperText={errors.customerCode?.message}
              {...register('customerCode', { required: 'Vui lòng nhập tên khách hàng' })}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <TextField fullWidth label="Số điện thoại" placeholder="0901234567" {...register('phone')} />
              <TextField fullWidth label="Ngành" placeholder="VD: Spa, BĐS, Nhà hàng..." {...register('industry')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField fullWidth label="Web/Page" placeholder="https://example.com" {...register('website')} />
              <TextField fullWidth label="Link kế hoạch" placeholder="https://docs.google.com/..." {...register('planLink')} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextField fullWidth select label="Tình trạng" defaultValue={formDefaults.status} {...register('status')}>
                {CUSTOMER_STATUS_TABS.filter((item) => item !== 'Tất cả').map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>
              <Controller
                name="createdAt"
                control={control}
                render={({ field }) => (
                  <CustomerDatePicker label="Ngày phát sinh" value={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="closedAt"
                control={control}
                render={({ field }) => (
                  <CustomerDatePicker label="Ngày chốt khách" value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <TextField fullWidth label="Nhóm Zalo" placeholder="Tên nhóm hoặc link nhóm" {...register('zaloGroup')} />

            <TextField
              fullWidth
              multiline
              minRows={6}
              label="Ghi chú"
              placeholder="Nhập ghi chú chăm sóc, nhu cầu, phản hồi..."
              {...register('note')}
            />
          </FormSection>
        </div>

        <div className="xl:col-span-4">
          <FormSection title="Phân loại & phụ trách" description="Nhân sự, nguồn phát sinh và dịch vụ quan tâm.">
            <Controller
              name="owners"
              control={control}
              render={({ field }) => (
                <MultiSelectField
                  label="Nhân sự phụ trách"
                  options={optionGroups.owners}
                  value={field.value || []}
                  onChange={field.onChange}
                  placeholder="Chọn nhân sự"
                />
              )}
            />
            <Controller
              name="sources"
              control={control}
              render={({ field }) => (
                <MultiSelectField
                  label="Nguồn phát sinh"
                  options={optionGroups.sources}
                  value={field.value || []}
                  onChange={field.onChange}
                  placeholder="Chọn nguồn"
                />
              )}
            />
            <Controller
              name="services"
              control={control}
              render={({ field }) => (
                <MultiSelectField
                  label="Dịch vụ quan tâm"
                  options={optionGroups.services}
                  value={field.value || []}
                  onChange={field.onChange}
                  placeholder="Chọn dịch vụ"
                />
              )}
            />
          </FormSection>
        </div>
      </div>

      {savedPayload && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Đã chuẩn bị payload {mode === 'create' ? 'tạo mới' : 'cập nhật'} khách hàng. Chỉ cần thay TODO bằng API thật.
        </div>
      )}

      <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-slate-200 bg-white/90 px-1 py-4 backdrop-blur">
        <Link
          href="/customers"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Hủy
        </Link>
        <Button type="submit" variant="contained" disabled={isSubmitting} startIcon={<SaveRoundedIcon />}>
          {mode === 'create' ? 'Tạo khách hàng' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}
