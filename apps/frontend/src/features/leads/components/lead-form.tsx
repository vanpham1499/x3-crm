'use client';

import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, Checkbox, ListItemText, MenuItem } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { FormActionBar } from '@/components/form/form-action-bar';
import { ExternalLinkAdornment } from '@/components/form/external-link-adornment';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { applyApiErrorsToForm } from '@/lib/api-error';
import { getLeadDefaults } from '@/lib/lead-utils';
import type { Lead, LeadFormValues, LeadStatus } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

type LeadFormProps = {
  mode: 'create' | 'edit';
  lead?: Lead | null;
  users: User[];
  sources: AppOption[];
  services: AppOption[];
  statuses: LeadStatus[];
  isSubmitting: boolean;
  /** True when the current user has no edit permission on this record — every field is disabled. */
  readOnly?: boolean;
  onSubmit: (values: LeadFormValues) => Promise<unknown>;
};

function LeadDatePicker({
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

export function LeadForm({
  mode,
  lead,
  users,
  sources,
  services,
  statuses,
  isSubmitting,
  readOnly = false,
  onSubmit,
}: LeadFormProps) {
  const defaults = getLeadDefaults(lead);
  if (mode === 'create' && !defaults.statusOptionId && statuses[0]?.id !== undefined) {
    defaults.statusOptionId = String(statuses[0].id);
  }
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<LeadFormValues>({ defaultValues: defaults });
  const selectedSourceId = watch('sourceOptionId') || watch('sourceId');
  const typedSourceName = watch('sourceName');
  const websiteValue = watch('website');
  const planLinkValue = watch('planLink');
  const selectedSource = sources.find((source) => String(source.id) === selectedSourceId) || null;

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
          <FormSection title="Thông tin lead">
            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField
                label="Tên khách hàng *"
                placeholder="VD: ABC Spa - C.Linh"
                disabled={readOnly}
                error={Boolean(errors.customerName)}
                helperText={errors.customerName?.message}
                {...register('customerName', { required: 'Vui lòng nhập tên khách hàng' })}
              />
              <FormInputField
                label="Số điện thoại"
                placeholder="0901234567"
                disabled={readOnly}
                {...register('phone')}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField
                label="Ngành nghề"
                placeholder="VD: Spa, bất động sản..."
                disabled={readOnly}
                {...register('industry')}
              />
              <FormInputField
                label="Website"
                placeholder="Website, Fanpage hoặc GG Map"
                disabled={readOnly}
                slotProps={{
                  input: {
                    endAdornment: (
                      <ExternalLinkAdornment
                        value={websiteValue}
                        ariaLabel="Mở Website, Fanpage hoặc Google Map"
                      />
                    ),
                  },
                }}
                {...register('website')}
              />
            </div>

            <FormInputField
              label="Link kế hoạch"
              placeholder="https://docs.google.com/..."
              disabled={readOnly}
              slotProps={{
                input: {
                  endAdornment: (
                    <ExternalLinkAdornment
                      value={planLinkValue}
                      ariaLabel="Mở link kế hoạch trong tab mới"
                    />
                  ),
                },
              }}
              {...register('planLink')}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <Controller
                name="statusOptionId"
                control={control}
                render={({ field }) => (
                  <FormSelectField
                    label="Trạng thái"
                    disabled={readOnly}
                    {...field}
                    slotProps={{ inputLabel: { shrink: true } }}
                  >
                    {statuses.map((status) => (
                      <MenuItem key={status.id} value={String(status.id)}>
                        {status.name}
                      </MenuItem>
                    ))}
                  </FormSelectField>
                )}
              />
              <Controller
                name="occurredDate"
                control={control}
                render={({ field }) => (
                  <LeadDatePicker
                    label="Ngày phát sinh"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={readOnly}
                  />
                )}
              />
              <Controller
                name="closedDate"
                control={control}
                render={({ field }) => (
                  <LeadDatePicker
                    label="Ngày chốt"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={readOnly}
                  />
                )}
              />
            </div>

            <FormInputField
              label="Nhóm Zalo"
              placeholder="Tên nhóm hoặc link nhóm"
              disabled={readOnly}
              {...register('zaloGroup')}
            />

            <FormInputField
              multiline
              minRows={6}
              label="Ghi chú"
              placeholder="Nhập ghi chú chăm sóc, nhu cầu, phản hồi..."
              disabled={readOnly}
              {...register('note')}
            />
          </FormSection>
        </div>

        <div className="xl:col-span-4">
          <FormSection title="Phân loại & phụ trách">
            <FormSelectField
              required
              label="Nhân sự phụ trách"
              disabled={readOnly}
              defaultValue={defaults.assignedUserId}
              error={Boolean(errors.assignedUserId)}
              helperText={errors.assignedUserId?.message}
              {...register('assignedUserId', {
                required: 'Vui lòng chọn nhân sự phụ trách',
              })}
            >
              {users.map((user) => (
                <MenuItem key={user.id} value={String(user.id)}>
                  {user.name || user.email || user.code}
                </MenuItem>
              ))}
            </FormSelectField>

            <input type="hidden" {...register('sourceId')} />
            <input type="hidden" {...register('sourceOptionId')} />
            <input
              type="hidden"
              {...register('sourceName', {
                validate: (value) => value.trim() !== '' || 'Vui lòng chọn nguồn phát sinh',
              })}
            />
            <Autocomplete
              freeSolo
              disabled={readOnly}
              options={sources}
              value={selectedSource || typedSourceName || null}
              inputValue={selectedSource?.label || typedSourceName || ''}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
              isOptionEqualToValue={(option, value) =>
                typeof option !== 'string' && typeof value !== 'string' && option.id === value.id
              }
              onChange={(_, nextValue) => {
                if (typeof nextValue === 'string') {
                  setValue('sourceId', '');
                  setValue('sourceOptionId', '');
                  setValue('sourceName', nextValue, { shouldValidate: true });
                  return;
                }

                setValue('sourceId', '');
                setValue('sourceOptionId', nextValue?.id !== undefined ? String(nextValue.id) : '');
                setValue('sourceName', nextValue?.label || '', { shouldValidate: true });
              }}
              onInputChange={(_, nextValue, reason) => {
                if (reason === 'input') {
                  setValue('sourceId', '');
                  setValue('sourceOptionId', '');
                  setValue('sourceName', nextValue, { shouldValidate: true });
                }
              }}
              renderInput={(params) => (
                <FormInputField
                  {...params}
                  required
                  label="Nguồn phát sinh"
                  placeholder="Chọn nguồn hoặc nhập nguồn mới"
                  error={Boolean(errors.sourceName)}
                  helperText={errors.sourceName?.message}
                />
              )}
            />

            <Controller
              name="interestedServiceOptionIds"
              control={control}
              rules={{
                validate: (value) =>
                  value.length > 0 || 'Vui lòng chọn ít nhất một dịch vụ quan tâm',
              }}
              render={({ field }) => (
                <FormSelectField
                  required
                  label="Dịch vụ quan tâm"
                  disabled={readOnly}
                  value={field.value || []}
                  error={Boolean(errors.interestedServiceOptionIds)}
                  helperText={errors.interestedServiceOptionIds?.message}
                  onChange={(event) => {
                    const value = event.target.value;
                    field.onChange(typeof value === 'string' ? value.split(',') : value);
                  }}
                  slotProps={{
                    inputLabel: { shrink: true },
                    select: {
                      multiple: true,
                      renderValue: (selected) => {
                        const selectedIds = selected as string[];
                        if (!selectedIds.length) return 'Chưa chọn';

                        return services
                          .filter((service) => selectedIds.includes(String(service.id)))
                          .map((service) => service.label)
                          .join(', ');
                      },
                    },
                  }}
                >
                  {services.map((service) => (
                    <MenuItem key={service.id} value={String(service.id)}>
                      <Checkbox checked={(field.value || []).includes(String(service.id))} />
                      <ListItemText primary={service.label} />
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />

            <FormInputField
              label="Dịch vụ quan tâm khác"
              placeholder="Nhập nếu chưa có trong danh mục"
              disabled={readOnly}
              {...register('interestedServiceText')}
            />
          </FormSection>
        </div>
      </div>

      <FormActionBar
        cancelHref="/leads"
        submitLabel={mode === 'create' ? 'Tạo lead' : 'Lưu thay đổi'}
        isSubmitting={isSubmitting}
        submitDisabled={readOnly}
        submitIcon={<SaveRoundedIcon />}
      />
    </form>
  );
}
