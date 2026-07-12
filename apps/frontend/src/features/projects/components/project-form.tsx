'use client';

import { useMemo } from 'react';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, MenuItem } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { FormActionBar } from '@/components/form/form-action-bar';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import {
  generateProjectCode,
  getProjectDefaults,
  getRootServiceCode,
  getRootServiceItem,
} from '@/lib/project-utils';
import {
  getConfigForRoot,
  getProjectRevenueGroupInfo,
  getServiceQuoteConfigMeta,
} from '@/lib/service-quote-config';
import { flattenServices } from '@/lib/service-utils';
import { formatCurrency } from '@/lib/utils';
import type { Customer } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { ProjectFormValues, ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

type ProjectFormProps = {
  mode: 'create' | 'edit';
  project?: ProjectItem | null;
  customers: Customer[];
  services: ServiceItem[];
  users: User[];
  statuses: AppOption[];
  quoteConfigs?: AppOption[];
  quotations?: Quotation[];
  defaultValues?: Partial<ProjectFormValues>;
  cancelHref?: string;
  isSubmitting: boolean;
  onSubmit: (values: ProjectFormValues) => void;
};

function ProjectDatePicker({
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

function customerLabel(customer: Customer) {
  return [customer.customerCode, customer.customerName || customer.companyName]
    .filter(Boolean)
    .join(' - ');
}

function userLabel(user: User) {
  return [user.code, user.name || user.email].filter(Boolean).join(' - ');
}

function serviceLabel(service: ReturnType<typeof flattenServices>[number]) {
  return `${service.code} - ${service.pathName}`;
}

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  sent: 'Đã gửi',
  won: 'Đã chốt',
  lost: 'Đã hủy',
};

function quotationLabel(quotation: Quotation) {
  return [
    quotation.quotationCode || `Báo phí #${quotation.id}`,
    quotation.customer?.customerName,
    quotation.serviceName,
    formatCurrency(Number(quotation.totalAmount) || 0),
  ]
    .filter(Boolean)
    .join(' · ');
}

function quotationMetadataText(quotation: Quotation, key: string) {
  const value = quotation.metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function ProjectForm({
  mode,
  project,
  customers,
  services,
  users,
  statuses,
  quoteConfigs = [],
  quotations = [],
  defaultValues,
  cancelHref = '/projects',
  isSubmitting,
  onSubmit,
}: ProjectFormProps) {
  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    defaultValues: getProjectDefaults(project, defaultValues),
  });
  const selectedQuotationId = useWatch({ control, name: 'quotationId' }) || '';
  const selectedCustomerId = useWatch({ control, name: 'customerId' }) || '';
  const selectedServiceId = useWatch({ control, name: 'serviceId' }) || '';
  const projectName = useWatch({ control, name: 'projectName' }) || '';
  const selectedCustomer = customers.find((customer) => String(customer.id) === selectedCustomerId);
  const selectedQuotation = quotations.find(
    (quotation) => String(quotation.id) === selectedQuotationId,
  );
  const originQuotationOptions = useMemo(
    () => quotations.filter((quotation) => !quotation.projectId),
    [quotations],
  );
  const selectedService = serviceOptions.find(
    (service) => String(service.id) === selectedServiceId,
  );
  const rootServiceCode = useMemo(
    () =>
      getRootServiceCode(services, selectedServiceId) ||
      selectedService?.parent?.code ||
      selectedService?.code ||
      '',
    [selectedService?.code, selectedService?.parent?.code, selectedServiceId, services],
  );
  const rootService = useMemo(
    () => getRootServiceItem(services, selectedServiceId),
    [selectedServiceId, services],
  );
  const quoteConfigOption = getConfigForRoot(quoteConfigs, rootService);
  const quoteConfig = quoteConfigOption
    ? getServiceQuoteConfigMeta(quoteConfigOption, rootService)
    : null;
  const usesAutomaticQuote = Boolean(quoteConfig?.enabled);
  const revenueGroup = getProjectRevenueGroupInfo(usesAutomaticQuote);
  const selectedCustomerCode =
    selectedCustomer?.customerCode || selectedCustomer?.lead?.leadCode || '';
  const generatedProjectCode = useMemo(
    () =>
      generateProjectCode({
        customerCode: selectedCustomerCode,
        rootServiceCode,
        projectName,
      }),
    [projectName, rootServiceCode, selectedCustomerCode],
  );
  const displayedProjectCode =
    generatedProjectCode || (mode === 'edit' ? project?.projectCode || '' : '');

  const applyOriginQuotation = (quotation: Quotation | null) => {
    setValue('quotationId', quotation ? String(quotation.id) : '', {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (!quotation) return;

    setValue('customerId', quotation.customerId ? String(quotation.customerId) : '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('serviceId', quotation.serviceId ? String(quotation.serviceId) : '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(
      'projectName',
      quotationMetadataText(quotation, 'projectName') || quotation.serviceName || '',
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <form
      className="flex w-full flex-1 flex-col gap-5"
      onSubmit={handleSubmit((values) =>
        onSubmit({
          ...values,
          projectCode: displayedProjectCode,
        }),
      )}
    >
      {mode === 'edit' ? <input type="hidden" {...register('quotationId')} /> : null}
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <FormSection title="Thông tin dự án">
            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="customerId"
                control={control}
                rules={{ required: 'Vui lòng chọn khách hàng' }}
                render={({ field }) => (
                  <FormSelectField
                    label="Khách hàng *"
                    disabled={Boolean(selectedQuotation)}
                    error={Boolean(errors.customerId)}
                    helperText={errors.customerId?.message}
                    {...field}
                  >
                    {customers.map((customer) => (
                      <MenuItem key={customer.id} value={String(customer.id)}>
                        {customerLabel(customer)}
                      </MenuItem>
                    ))}
                  </FormSelectField>
                )}
              />

              <Controller
                name="serviceId"
                control={control}
                rules={{ required: 'Vui lòng chọn dịch vụ' }}
                render={({ field }) => {
                  const selectedServiceOption =
                    serviceOptions.find((service) => String(service.id) === field.value) || null;

                  return (
                    <Autocomplete
                      options={serviceOptions}
                      value={selectedServiceOption}
                      onChange={(_, nextValue) =>
                        field.onChange(nextValue?.id !== undefined ? String(nextValue.id) : '')
                      }
                      getOptionLabel={serviceLabel}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      filterOptions={(options, state) => {
                        const keyword = state.inputValue.trim().toLowerCase();
                        if (!keyword) return options;

                        return options.filter((service) =>
                          [service.code, service.name, service.pathName]
                            .join(' ')
                            .toLowerCase()
                            .includes(keyword),
                        );
                      }}
                      renderInput={(params) => (
                        <FormInputField
                          {...params}
                          label="Dịch vụ *"
                          disabled={Boolean(selectedQuotation)}
                          placeholder="Tìm theo mã hoặc tên dịch vụ"
                          error={Boolean(errors.serviceId)}
                          helperText={errors.serviceId?.message}
                        />
                      )}
                    />
                  );
                }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="projectName"
                control={control}
                rules={{ required: 'Vui lòng nhập tên dự án' }}
                render={({ field }) => (
                  <FormInputField
                    {...field}
                    value={field.value || ''}
                    label="Tên dự án *"
                    error={Boolean(errors.projectName)}
                    helperText={errors.projectName?.message}
                  />
                )}
              />
              <Controller
                name="projectCode"
                control={control}
                render={({ field }) => (
                  <FormInputField
                    {...field}
                    value={displayedProjectCode}
                    label="Mã dự án"
                    placeholder="Chọn khách hàng, dịch vụ và nhập tên dự án"
                    className="[&_.MuiOutlinedInput-root]:!bg-emerald-50/60"
                    slotProps={{
                      htmlInput: { readOnly: true },
                      inputLabel: { shrink: true },
                    }}
                  />
                )}
              />
            </div>

            <FormInputField
              label="Link plan"
              placeholder="https://docs.google.com/..."
              {...register('planLink')}
            />

            <FormInputField
              label="Nhóm Zalo"
              placeholder="Tên nhóm hoặc link nhóm"
              {...register('zaloGroup')}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <ProjectDatePicker
                    label="Ngày bắt đầu"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <ProjectDatePicker
                    label="Ngày kết thúc"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <FormInputField
              multiline
              minRows={3}
              label="Ghi chú"
              placeholder="Thông tin triển khai, lưu ý chăm sóc, tình trạng hiện tại..."
              {...register('note')}
            />
          </FormSection>
        </div>

        <div className="space-y-6 xl:col-span-4">
          {mode === 'create' ? (
            <FormSection title="Báo phí khởi tạo">
              <Controller
                name="quotationId"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={originQuotationOptions}
                    value={
                      originQuotationOptions.find(
                        (quotation) => String(quotation.id) === field.value,
                      ) || null
                    }
                    onChange={(_, nextValue) => applyOriginQuotation(nextValue)}
                    getOptionLabel={quotationLabel}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    getOptionDisabled={(option) => !option.customerId || option.status === 'lost'}
                    noOptionsText="Không có báo phí chưa gắn dự án"
                    renderOption={(props, option) => (
                      <li {...props} key={option.id}>
                        <div className="min-w-0 py-1">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {option.quotationCode || `Báo phí #${option.id}`}
                            <span className="ml-2 font-medium text-slate-400">
                              {QUOTATION_STATUS_LABELS[option.status || ''] || option.status}
                            </span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {option.customer?.customerName ||
                              'Chưa có khách hàng — cần chuyển Lead thành khách hàng'}
                            {' · '}
                            {option.serviceName || 'Chưa chọn dịch vụ'}
                            {' · '}
                            {formatCurrency(Number(option.totalAmount) || 0)}
                          </p>
                        </div>
                      </li>
                    )}
                    renderInput={(params) => (
                      <FormInputField
                        {...params}
                        label="Báo phí"
                        placeholder="Tìm theo mã, khách hàng hoặc dịch vụ"
                      />
                    )}
                  />
                )}
              />

              <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5">
                {selectedQuotation ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                        {selectedQuotation.quotationCode || `#${selectedQuotation.id}`}
                      </p>
                      <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-950">
                        {formatCurrency(Number(selectedQuotation.totalAmount) || 0)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {selectedQuotation.customer?.customerName || 'Chưa có khách hàng'}
                      {' · '}
                      {selectedQuotation.serviceName || 'Chưa chọn dịch vụ'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-600">Tạo dự án độc lập</p>
                )}
              </div>
            </FormSection>
          ) : null}

          <FormSection title="Trạng thái & phụ trách">
            <div
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                revenueGroup.group === '2.1'
                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <span className="font-semibold">Nhóm dữ liệu: </span>
              <strong>{revenueGroup.title}</strong>
            </div>
            <Controller
              name="statusOptionId"
              control={control}
              render={({ field }) => (
                <FormSelectField label="Trạng thái" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {statuses.map((status) => (
                    <MenuItem key={status.id} value={String(status.id)}>
                      {status.label}
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />

            <Controller
              name="managerUserId"
              control={control}
              render={({ field }) => (
                <FormSelectField label="Người quản lý" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={String(user.id)}>
                      {userLabel(user)}
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />

            <Controller
              name="salesUserId"
              control={control}
              render={({ field }) => (
                <FormSelectField label="Sales phụ trách" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={String(user.id)}>
                      {userLabel(user)}
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
        submitLabel={mode === 'create' ? 'Tạo dự án' : 'Lưu thay đổi'}
        isSubmitting={isSubmitting}
        submitIcon={<SaveRoundedIcon />}
      />
    </form>
  );
}
