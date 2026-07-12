'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, Button, MenuItem, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
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
  isSubmitting: boolean;
  onSubmit: (values: ProjectFormValues) => void;
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

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
      slotProps={{ textField: { fullWidth: true } }}
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
  isSubmitting,
  onSubmit,
}: ProjectFormProps) {
  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    defaultValues: getProjectDefaults(project, defaultValues),
  });
  const selectedQuotationId = watch('quotationId');
  const selectedCustomerId = watch('customerId');
  const selectedServiceId = watch('serviceId');
  const projectName = watch('projectName');
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
    () => getRootServiceCode(services, selectedServiceId),
    [selectedServiceId, services],
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
  const hasManagementFeeConfig = Boolean(
    usesAutomaticQuote && quoteConfig?.managementFeeRates.length,
  );

  useEffect(() => {
    const nextProjectCode = generateProjectCode({
      customerCode: selectedCustomer?.customerCode,
      rootServiceCode,
      projectName,
    });

    setValue('projectCode', nextProjectCode, { shouldDirty: true });
  }, [projectName, rootServiceCode, selectedCustomer?.customerCode, setValue]);

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
    <form className="w-full space-y-5" onSubmit={handleSubmit(onSubmit)}>
      {mode === 'create' ? (
        <section className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:items-center">
            <div>
              <div className="mb-3">
                <h2 className="text-base font-bold text-slate-950">Bắt đầu từ báo phí có sẵn</h2>
              </div>

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
                      <TextField
                        {...params}
                        fullWidth
                        label="Báo phí khởi tạo"
                        placeholder="Tìm theo mã, khách hàng hoặc dịch vụ"
                      />
                    )}
                  />
                )}
              />
            </div>

            <div className="rounded-xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
              {selectedQuotation ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
                    Báo phí được chọn
                  </p>
                  <p className="mt-1 font-extrabold text-slate-950">
                    {selectedQuotation.quotationCode || `#${selectedQuotation.id}`}
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="text-xs text-slate-500">Tổng tiền báo phí</span>
                    <span className="text-base font-extrabold tabular-nums text-slate-950">
                      {formatCurrency(Number(selectedQuotation.totalAmount) || 0)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-slate-800">Tạo dự án độc lập</p>
                </>
              )}
            </div>
          </div>
        </section>
      ) : (
        <input type="hidden" {...register('quotationId')} />
      )}
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <FormSection
            title="Thông tin dự án"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                fullWidth
                placeholder="Mã dự án"
                className="bg-slate-50"
                slotProps={{
                  htmlInput: { readOnly: true },
                  inputLabel: { shrink: true },
                }}
                {...register('projectCode')}
              />
              <TextField
                fullWidth
                label="Tên dự án *"
                error={Boolean(errors.projectName)}
                helperText={errors.projectName?.message}
                {...register('projectName', { required: 'Vui lòng nhập tên dự án' })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="customerId"
                control={control}
                rules={{ required: 'Vui lòng chọn khách hàng' }}
                render={({ field }) => (
                  <TextField
                    fullWidth
                    select
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
                  </TextField>
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
                        <TextField
                          {...params}
                          fullWidth
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

            <TextField
              fullWidth
              label="Link plan"
              placeholder="https://docs.google.com/..."
              {...register('planLink')}
            />

            <TextField
              fullWidth
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

            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Ghi chú"
              placeholder="Thông tin triển khai, lưu ý chăm sóc, tình trạng hiện tại..."
              {...register('note')}
            />
          </FormSection>

        </div>

        <div className="xl:col-span-4">
          <FormSection
            title="Trạng thái & phụ trách"
          >
            <Controller
              name="statusOptionId"
              control={control}
              render={({ field }) => (
                <TextField fullWidth select label="Trạng thái" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {statuses.map((status) => (
                    <MenuItem key={status.id} value={String(status.id)}>
                      {status.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="managerUserId"
              control={control}
              render={({ field }) => (
                <TextField fullWidth select label="Người quản lý" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={String(user.id)}>
                      {userLabel(user)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="salesUserId"
              control={control}
              render={({ field }) => (
                <TextField fullWidth select label="Sales phụ trách" {...field}>
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={String(user.id)}>
                      {userLabel(user)}
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
          href="/projects"
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
          {isSubmitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo dự án' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}
