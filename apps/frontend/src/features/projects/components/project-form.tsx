'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, Button, MenuItem, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { MoneyInput } from '@/components/form/money-input';
import {
  generateProjectCode,
  getProjectDefaults,
  getRootServiceCode,
  getRootServiceItem,
} from '@/lib/project-utils';
import { getConfigForRoot, getServiceQuoteConfigMeta } from '@/lib/service-quote-config';
import { flattenServices } from '@/lib/service-utils';
import { formatCurrency } from '@/lib/utils';
import type { Customer } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { ProjectFormValues, ProjectItem } from '@/types/project';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

type ProjectFormProps = {
  mode: 'create' | 'edit';
  project?: ProjectItem | null;
  customers: Customer[];
  services: ServiceItem[];
  users: User[];
  statuses: AppOption[];
  contractStatuses: AppOption[];
  quoteConfigs?: AppOption[];
  defaultValues?: Partial<ProjectFormValues>;
  isSubmitting: boolean;
  onSubmit: (values: ProjectFormValues) => void;
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

export function ProjectForm({
  mode,
  project,
  customers,
  services,
  users,
  statuses,
  contractStatuses,
  quoteConfigs = [],
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
    values: getProjectDefaults(project, defaultValues),
  });
  const selectedCustomerId = watch('customerId');
  const selectedServiceId = watch('serviceId');
  const projectName = watch('projectName');
  const signedDate = watch('signedDate');
  const expiredDate = watch('expiredDate');
  const computedContractMonths =
    signedDate && expiredDate && dayjs(expiredDate).isAfter(dayjs(signedDate))
      ? dayjs(expiredDate).diff(dayjs(signedDate), 'month')
      : null;
  const selectedCustomer = customers.find(
    (customer) => String(customer.id) === selectedCustomerId,
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
  const hasManagementFeeConfig = Boolean(quoteConfig?.enabled && quoteConfig.managementFeeRates.length);

  useEffect(() => {
    const nextProjectCode = generateProjectCode({
      customerCode: selectedCustomer?.customerCode,
      rootServiceCode,
      projectName,
    });

    setValue('projectCode', nextProjectCode, { shouldDirty: true });
    setValue('contractNo', nextProjectCode, { shouldDirty: true });
  }, [projectName, rootServiceCode, selectedCustomer?.customerCode, setValue]);

  return (
    <form className="w-full space-y-8" onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register('quotationId')} />
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <FormSection
            title="Thông tin dự án"
            description="Thông tin định danh, khách hàng, dịch vụ và thời gian triển khai."
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

            {hasManagementFeeConfig && quoteConfig ? (
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-sm font-semibold text-slate-600">
                  % phí quản lý theo ngân sách ({rootService?.code})
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Doanh thu dự kiến = Ngân sách quảng cáo × % phí quản lý tương ứng bậc ngân sách.
                </p>
                <div className="mt-3 space-y-1">
                  {quoteConfig.managementFeeRates.map((rate) => (
                    <div key={rate.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{rate.label}</span>
                      <span className="font-bold text-slate-950">{rate.single}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedService?.defaultPrice ? (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                <span className="text-sm font-semibold text-slate-600">Đơn giá dịch vụ</span>
                <span className="text-sm font-bold text-slate-950">
                  {formatCurrency(selectedService.defaultPrice)}
                  {selectedService.unit ? (
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      / {selectedService.unit}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}

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

          <FormSection
            title="Hợp đồng"
            description="Thông tin tình trạng, thời hạn, đặt cọc và file hợp đồng của dự án."
          >
            <input type="hidden" {...register('contractId')} />
            <input type="hidden" {...register('contractNo')} />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Controller
                name="contractStatusOptionId"
                control={control}
                render={({ field }) => (
                  <TextField fullWidth select label="Tình trạng hợp đồng" {...field}>
                    <MenuItem value="">Chưa chọn</MenuItem>
                    {contractStatuses.map((status) => (
                      <MenuItem key={status.id} value={String(status.id)}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              <Controller
                name="depositAmount"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    fullWidth
                    label="Số tiền cọc"
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <TextField
                fullWidth
                label="Thời hạn hợp đồng"
                placeholder="Ví dụ: 6 tháng"
                helperText={
                  computedContractMonths !== null
                    ? `Theo ngày ký/hết hạn: khoảng ${computedContractMonths} tháng`
                    : undefined
                }
                {...register('contractMonth')}
              />

              <Controller
                name="signedDate"
                control={control}
                render={({ field }) => (
                  <ProjectDatePicker
                    label="Ngày ký"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="expiredDate"
                control={control}
                render={({ field }) => (
                  <ProjectDatePicker
                    label="Ngày hết hạn"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <TextField
                fullWidth
                label="File hợp đồng"
                placeholder="https://... hoặc /uploads/..."
                {...register('fileUrl')}
              />
            </div>

            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Ghi chú hợp đồng"
              placeholder="Điều khoản đặc biệt, ghi chú riêng cho hợp đồng..."
              {...register('contractNote')}
            />
          </FormSection>
        </div>

        <div className="xl:col-span-4">
          <FormSection
            title="Trạng thái & phụ trách"
            description="Trạng thái dự án và nhân sự phụ trách triển khai."
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

            {project ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-100">
                <p className="font-bold text-slate-950">{project.projectName}</p>
                <p className="mt-1">Mã dự án: {project.projectCode || 'Hệ thống tự tạo'}</p>
                <p className="mt-1">Khách hàng: {project.customer?.customerName || '-'}</p>
              </div>
            ) : null}
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
