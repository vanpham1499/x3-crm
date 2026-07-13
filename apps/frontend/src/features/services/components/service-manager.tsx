'use client';

import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PriceCheckRoundedIcon from '@mui/icons-material/PriceCheckRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { MoneyInput } from '@/components/form/money-input';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { applyApiErrorsToForm } from '@/lib/api-error';
import {
  DEFAULT_MANAGEMENT_FEE_RATES,
  DEFAULT_SETUP_PACKAGES,
  getConfigForRoot,
  getServiceQuoteConfigMeta,
  type ServiceQuoteConfigMeta,
} from '@/lib/service-quote-config';
import { flattenServices, getServiceDefaults } from '@/lib/service-utils';
import type { FlatServiceItem } from '@/lib/service-utils';
import type { AppOption } from '@/types/option';
import type { ServiceFilters, ServiceFormValues, ServiceItem } from '@/types/service';

type ServiceManagerProps = {
  services: ServiceItem[];
  filters: ServiceFilters;
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  isSavingQuoteConfig: boolean;
  quoteConfigs: AppOption[];
  onFiltersChange: (filters: ServiceFilters) => void;
  onSubmit: (values: ServiceFormValues, service?: ServiceItem | null) => Promise<unknown>;
  onDelete: (service: ServiceItem) => void;
  onSaveQuoteConfig: (
    service: ServiceItem,
    values: ServiceQuoteConfigMeta,
    option?: AppOption | null,
  ) => Promise<unknown>;
};

type DialogState =
  | { mode: 'create'; service?: null; parent?: ServiceItem | null }
  | { mode: 'edit'; service: ServiceItem; parent?: null };

type QuoteConfigDialogState = {
  service: ServiceItem;
  option?: AppOption | null;
};

function serviceStatusClass(service: ServiceItem) {
  return service.isActive
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    : 'bg-slate-100 text-slate-600 ring-slate-200';
}

const ROOT_COLOR_CLASSES = [
  {
    row: 'border-l-sky-400',
    icon: 'bg-sky-50 text-sky-700 ring-sky-100',
    code: 'bg-sky-50 text-sky-700 ring-sky-100',
    child: 'bg-sky-50/50',
  },
  {
    row: 'border-l-emerald-400',
    icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    code: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    child: 'bg-emerald-50/50',
  },
  {
    row: 'border-l-violet-400',
    icon: 'bg-violet-50 text-violet-700 ring-violet-100',
    code: 'bg-violet-50 text-violet-700 ring-violet-100',
    child: 'bg-violet-50/50',
  },
  {
    row: 'border-l-amber-400',
    icon: 'bg-amber-50 text-amber-700 ring-amber-100',
    code: 'bg-amber-50 text-amber-700 ring-amber-100',
    child: 'bg-amber-50/50',
  },
  {
    row: 'border-l-rose-400',
    icon: 'bg-rose-50 text-rose-700 ring-rose-100',
    code: 'bg-rose-50 text-rose-700 ring-rose-100',
    child: 'bg-rose-50/50',
  },
];

function getRootServiceId(service: FlatServiceItem) {
  return service.pathName.split(' / ')[0];
}

function canUseAsParent(option: FlatServiceItem, current?: ServiceItem | null) {
  if (!current) return true;
  if (option.id === current.id) return false;

  return !option.pathName.startsWith(`${current.name} /`);
}

function ServiceFormDialog({
  state,
  services,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: DialogState | null;
  services: ServiceItem[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ServiceFormValues, service?: ServiceItem | null) => Promise<unknown>;
}) {
  const currentService = state?.mode === 'edit' ? state.service : null;
  const parentService = state?.mode === 'create' ? state.parent : null;
  const parentOptions = useMemo(() => flattenServices(services), [services]);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ServiceFormValues>({
    values: getServiceDefaults(currentService || undefined, parentService || undefined),
  });

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <Dialog
      open={Boolean(state)}
      onClose={isSubmitting ? undefined : closeDialog}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle className="border-b border-slate-100 px-6 py-5">
        <p className="text-lg font-bold text-slate-950">
          {state?.mode === 'edit' ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Quản lý nhóm dịch vụ theo cây để dùng cho dự án, doanh thu và hóa đơn.
        </p>
      </DialogTitle>

      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            await onSubmit(values, currentService);
            closeDialog();
          } catch (error) {
            applyApiErrorsToForm(error, setError);
          }
        })}
      >
        <DialogContent className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <TextField
            fullWidth
            label="Mã dịch vụ *"
            placeholder="DV01"
            error={Boolean(errors.code)}
            helperText={errors.code?.message}
            {...register('code', { required: 'Bắt buộc' })}
          />

          <TextField
            fullWidth
            label="Tên dịch vụ *"
            placeholder="SEO tổng thể"
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
            {...register('name', { required: 'Bắt buộc' })}
          />

          <Controller
            name="parentId"
            control={control}
            render={({ field }) => (
              <TextField fullWidth select label="Dịch vụ cha" {...field}>
                <MenuItem value="">Không có</MenuItem>
                {parentOptions
                  .filter((option) => canUseAsParent(option, currentService))
                  .map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {'— '.repeat(option.depth)}
                      {option.name}
                    </MenuItem>
                  ))}
              </TextField>
            )}
          />

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Nội dung"
            className="md:col-span-2"
            {...register('content')}
          />

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Nội dung hóa đơn"
            {...register('invoiceContent')}
          />

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Thời điểm xuất hóa đơn"
            {...register('invoiceTiming')}
          />
        </DialogContent>

        <DialogActions className="border-t border-slate-100 px-6 py-4">
          <Button variant="outlined" onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            {isSubmitting ? 'Đang lưu...' : state?.mode === 'edit' ? 'Lưu thay đổi' : 'Tạo dịch vụ'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function QuoteConfigDialog({
  state,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: QuoteConfigDialogState | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (
    service: ServiceItem,
    values: ServiceQuoteConfigMeta,
    option?: AppOption | null,
  ) => Promise<unknown>;
}) {
  const [config, setConfig] = useState<ServiceQuoteConfigMeta>(() =>
    getServiceQuoteConfigMeta(null),
  );

  useEffect(() => {
    if (!state) return;
    setConfig(getServiceQuoteConfigMeta(state.option, state.service));
  }, [state]);

  const updateRate = (index: number, field: 'single' | 'multi', value: string) => {
    setConfig((current) => ({
      ...current,
      managementFeeRates: current.managementFeeRates.map((rate, rateIndex) =>
        rateIndex === index ? { ...rate, [field]: Number(value) || 0 } : rate,
      ),
    }));
  };

  const updateSetupPackage = (index: number, value: string) => {
    setConfig((current) => ({
      ...current,
      setupPackages: current.setupPackages.map((setupPackage, packageIndex) =>
        packageIndex === index ? { ...setupPackage, price: Number(value) || 0 } : setupPackage,
      ),
    }));
  };

  const resetDefaults = () => {
    if (!state) return;
    setConfig({
      serviceRootId: String(state.service.id),
      serviceRootCode: state.service.code,
      enabled: true,
      managementFeeRates: DEFAULT_MANAGEMENT_FEE_RATES,
      setupPackages: DEFAULT_SETUP_PACKAGES,
    });
  };

  return (
    <Dialog
      open={Boolean(state)}
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle className="border-b border-slate-100 px-5 py-4">
        <p className="text-base font-bold text-slate-950">Cấu hình báo giá dịch vụ</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {state?.service.code} - {state?.service.name}
        </p>
      </DialogTitle>

      <DialogContent className="space-y-4 px-5 py-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 py-2.5">
          <div>
            <p className="text-sm font-bold text-slate-950">Áp dụng tự động trong báo giá</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Các dịch vụ con thuộc nhóm này sẽ dùng cùng bảng phí.
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onChange={(event) =>
              setConfig((current) => ({ ...current, enabled: event.target.checked }))
            }
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <p className="text-sm font-bold text-slate-950">% phí quản lý theo ngân sách</p>
          </div>
          <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
            {config.managementFeeRates.map((rate, index) => (
              <div
                key={rate.label}
                className="flex items-center justify-between gap-3 bg-white px-3.5 py-2"
              >
                <span className="text-xs font-semibold text-slate-700">{rate.label}</span>
                <TextField
                  size="small"
                  type="number"
                  value={rate.single}
                  onChange={(event) => updateRate(index, 'single', event.target.value)}
                  slotProps={{ htmlInput: { min: 0, className: 'py-1.5 text-right' } }}
                  className="w-24"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {config.setupPackages.map((setupPackage, index) => (
            <MoneyInput
              key={setupPackage.key}
              fullWidth
              label={`Phí setup - ${setupPackage.label}`}
              value={setupPackage.price}
              onValueChange={(value) => updateSetupPackage(index, value)}
            />
          ))}
        </div>
      </DialogContent>

      <DialogActions className="border-t border-slate-100 px-5 py-3">
        <Button size="small" variant="text" onClick={resetDefaults} disabled={isSubmitting}>
          Mặc định
        </Button>
        <div className="flex-1" />
        <Button size="small" variant="outlined" onClick={onClose} disabled={isSubmitting}>
          Hủy
        </Button>
        <Button
          type="button"
          size="small"
          variant="contained"
          disabled={isSubmitting || !state}
          onClick={async () => {
            if (!state) return;
            await onSubmit(state.service, config, state.option);
            onClose();
          }}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          {isSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ServiceManager({
  services,
  filters,
  isFetching,
  isSubmitting,
  isDeleting,
  isSavingQuoteConfig,
  quoteConfigs,
  onFiltersChange,
  onSubmit,
  onDelete,
  onSaveQuoteConfig,
}: ServiceManagerProps) {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [quoteConfigDialogState, setQuoteConfigDialogState] =
    useState<QuoteConfigDialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const flatServices = useMemo(() => flattenServices(services), [services]);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(
    flatServices,
    { resetKey: filters },
  );
  const rootColorMap = useMemo(() => {
    const roots = flatServices.filter((service) => service.depth === 0);

    return new Map(
      roots.map((service, index) => [
        service.name,
        ROOT_COLOR_CLASSES[index % ROOT_COLOR_CLASSES.length],
      ]),
    );
  }, [flatServices]);

  const updateFilters = (nextFilters: Partial<ServiceFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Dịch vụ</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Dự án</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Dịch vụ</span>
          </div>
        </div>

        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setDialogState({ mode: 'create', parent: null })}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Thêm dịch vụ
        </Button>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm mã, tên, nội dung dịch vụ..."
            value={filters.keyword}
            onChange={(event) => updateFilters({ keyword: event.target.value })}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            select
            label="Trạng thái"
            value={filters.is_active}
            onChange={(event) => updateFilters({ is_active: event.target.value })}
            className="lg:w-56"
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="true">Hoạt động</MenuItem>
            <MenuItem value="false">Tạm tắt</MenuItem>
          </TextField>
        </div>

        <div className="relative overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-20">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[1160px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-[390px] px-5 py-4">Dịch vụ</th>
                <th className="w-36 px-3 py-4">Trạng thái</th>
                <th className="w-[260px] px-3 py-4">Nội dung</th>
                <th className="w-[260px] px-3 py-4">Nội dung hóa đơn</th>
                <th className="w-[220px] px-3 py-4">Thời điểm hóa đơn</th>
                <th className="w-36 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flatServices.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm font-semibold text-slate-500"
                  >
                    Chưa có dịch vụ nào
                  </td>
                </tr>
              ) : (
                pageItems.map((service) => {
                  const color =
                    rootColorMap.get(getRootServiceId(service)) || ROOT_COLOR_CLASSES[0];

                  return (
                    <tr
                      key={service.id}
                      className={`group border-l-4 ${color.row} hover:bg-slate-50/80`}
                    >
                      <td className={`px-5 py-4 ${service.depth > 0 ? color.child : ''}`}>
                        <div
                          className="flex min-w-0 items-start gap-3"
                          style={{ paddingLeft: service.depth * 24 }}
                        >
                          <span
                            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${color.icon}`}
                          >
                            {service.depth === 0 ? (
                              <AccountTreeRoundedIcon fontSize="small" />
                            ) : (
                              <SubdirectoryArrowRightRoundedIcon fontSize="small" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ring-1 ${color.code}`}
                              >
                                {service.code}
                              </span>
                              <p className="truncate font-bold text-slate-950" title={service.name}>
                                {service.name}
                              </p>
                            </div>
                            <p
                              className="mt-1 truncate text-xs leading-5 text-slate-500"
                              title={service.pathName}
                            >
                              {service.pathName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${serviceStatusClass(service)}`}
                        >
                          {service.isActive ? 'Hoạt động' : 'Tạm tắt'}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <p className="line-clamp-2 text-slate-600" title={service.content || ''}>
                          {service.content || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <p
                          className="line-clamp-2 text-slate-600"
                          title={service.invoiceContent || ''}
                        >
                          {service.invoiceContent || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <p
                          className="line-clamp-2 text-slate-600"
                          title={service.invoiceTiming || ''}
                        >
                          {service.invoiceTiming || '-'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {service.depth === 0 && (
                            <IconButton
                              size="small"
                              title="Cấu hình báo giá"
                              onClick={() =>
                                setQuoteConfigDialogState({
                                  service,
                                  option: getConfigForRoot(quoteConfigs, service),
                                })
                              }
                            >
                              <PriceCheckRoundedIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            title="Thêm dịch vụ con"
                            onClick={() => setDialogState({ mode: 'create', parent: service })}
                          >
                            <AddRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Chỉnh sửa"
                            onClick={() => setDialogState({ mode: 'edit', service })}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Xóa"
                            className="hover:text-rose-600"
                            onClick={() => setDeleteTarget(service)}
                          >
                            <DeleteRoundedIcon fontSize="small" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>

      <ServiceFormDialog
        state={dialogState}
        services={services}
        isSubmitting={isSubmitting}
        onClose={() => setDialogState(null)}
        onSubmit={(values, service) => onSubmit(values, service)}
      />

      <QuoteConfigDialog
        state={quoteConfigDialogState}
        isSubmitting={isSavingQuoteConfig}
        onClose={() => setQuoteConfigDialogState(null)}
        onSubmit={onSaveQuoteConfig}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa dịch vụ?"
        description={`Dịch vụ "${deleteTarget?.name || ''}" sẽ bị xóa nếu chưa có dịch vụ con, dự án hoặc doanh thu liên quan.`}
        confirmText="Xóa dịch vụ"
        loading={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
