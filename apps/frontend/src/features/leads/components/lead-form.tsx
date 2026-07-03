'use client';

import Link from 'next/link';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, Button, MenuItem, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { flattenServices } from '@/lib/service-utils';
import { getLeadDefaults } from '@/lib/lead-utils';
import type { CustomerSourceOption, Lead, LeadFormValues, LeadStatus } from '@/types/lead';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

type LeadFormProps = {
  mode: 'create' | 'edit';
  lead?: Lead | null;
  users: User[];
  sources: CustomerSourceOption[];
  services: ServiceItem[];
  statuses: LeadStatus[];
  isSubmitting: boolean;
  onSubmit: (values: LeadFormValues) => void;
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
      <div className="space-y-6 p-6">{children}</div>
    </section>
  );
}

function LeadDatePicker({
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

export function LeadForm({
  mode,
  lead,
  users,
  sources,
  services,
  statuses,
  isSubmitting,
  onSubmit,
}: LeadFormProps) {
  const defaults = getLeadDefaults(lead);
  const serviceOptions = flattenServices(services);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadFormValues>({ defaultValues: defaults });
  const selectedSourceId = watch('sourceId');
  const typedSourceName = watch('sourceName');
  const selectedSource = sources.find((source) => source.id === selectedSourceId) || null;

  return (
    <form className="w-full space-y-8" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <FormSection
            title="Thông tin lead"
            description="Thông tin liên hệ, trạng thái và thời gian chăm sóc."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                fullWidth
                label="Tên khách hàng *"
                placeholder="VD: ABC Spa - C.Linh"
                error={Boolean(errors.customerName)}
                helperText={errors.customerName?.message}
                {...register('customerName', { required: 'Vui lòng nhập tên khách hàng' })}
              />
              <TextField fullWidth label="Mã lead" placeholder="Tự sinh nếu để trống" {...register('leadCode')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField fullWidth label="Số điện thoại" placeholder="0901234567" {...register('phone')} />
              <TextField fullWidth label="Ngành" placeholder="VD: Spa, BĐS, Nhà hàng..." {...register('industry')} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField fullWidth label="Website" placeholder="https://example.com" {...register('website')} />
              <TextField fullWidth label="Link kế hoạch" placeholder="https://docs.google.com/..." {...register('planLink')} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextField fullWidth select label="Trạng thái" defaultValue={defaults.statusId} {...register('statusId')}>
                <MenuItem value="">Mặc định</MenuItem>
                {statuses.map((status) => (
                  <MenuItem key={status.id} value={status.id}>
                    {status.name}
                  </MenuItem>
                ))}
              </TextField>
              <Controller
                name="occurredDate"
                control={control}
                render={({ field }) => (
                  <LeadDatePicker label="Ngày phát sinh" value={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="closedDate"
                control={control}
                render={({ field }) => (
                  <LeadDatePicker label="Ngày chốt" value={field.value} onChange={field.onChange} />
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
          <FormSection
            title="Phân loại & phụ trách"
            description="Nhân sự, nguồn phát sinh và dịch vụ quan tâm."
          >
            <TextField fullWidth select label="Nhân sự phụ trách" defaultValue={defaults.assignedUserId} {...register('assignedUserId')}>
              <MenuItem value="">Chưa chọn</MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name || user.email || user.code}
                </MenuItem>
              ))}
            </TextField>

            <input type="hidden" {...register('sourceId')} />
            <input type="hidden" {...register('sourceName')} />
            <Autocomplete
              freeSolo
              options={sources}
              value={selectedSource || typedSourceName || null}
              inputValue={selectedSource?.name || typedSourceName || ''}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
              isOptionEqualToValue={(option, value) =>
                typeof option !== 'string' && typeof value !== 'string' && option.id === value.id
              }
              onChange={(_, nextValue) => {
                if (typeof nextValue === 'string') {
                  setValue('sourceId', '');
                  setValue('sourceName', nextValue);
                  return;
                }

                setValue('sourceId', nextValue?.id || '');
                setValue('sourceName', nextValue?.name || '');
              }}
              onInputChange={(_, nextValue, reason) => {
                if (reason === 'input') {
                  setValue('sourceId', '');
                  setValue('sourceName', nextValue);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  label="Nguồn phát sinh"
                  placeholder="Chọn nguồn hoặc nhập nguồn mới"
                />
              )}
            />

            <TextField fullWidth select label="Dịch vụ quan tâm" defaultValue={defaults.interestedServiceId} {...register('interestedServiceId')}>
              <MenuItem value="">Chưa chọn</MenuItem>
              {serviceOptions.map((service) => (
                <MenuItem key={service.id} value={service.id}>
                  {'— '.repeat(service.depth)}{service.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Dịch vụ quan tâm khác"
              placeholder="Nhập nếu chưa có trong danh mục"
              {...register('interestedServiceText')}
            />
          </FormSection>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-slate-200 bg-white/90 px-1 py-4 backdrop-blur">
        <Link
          href="/leads"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Hủy
        </Link>
        <Button type="submit" variant="contained" disabled={isSubmitting} startIcon={<SaveRoundedIcon />}>
          {isSubmitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo lead' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}
