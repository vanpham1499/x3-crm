'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import PriceCheckRoundedIcon from '@mui/icons-material/PriceCheckRounded';
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded';
import { IconButton, Menu, MenuItem, Switch } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { applyApiErrorsToForm } from '@/lib/api-error';
import { canManageCatalog } from '@/lib/ownership';
import {
  DEFAULT_MANAGEMENT_FEE_RATES,
  DEFAULT_SETUP_PACKAGES,
  getConfigForRoot,
  getServiceQuoteConfigMeta,
  type ServiceQuoteConfigMeta,
} from '@/lib/service-quote-config';
import { flattenServices, getServiceDefaults } from '@/lib/service-utils';
import type { FlatServiceItem } from '@/lib/service-utils';
import { useAuthStore } from '@/stores/auth-store';
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
    <AppFormDialog
      open={Boolean(state)}
      title={state?.mode === 'edit' ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ'}
      maxWidth="md"
      submitting={isSubmitting}
      contentClassName="space-y-4"
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values, currentService);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      actions={
        <>
          <DialogActionButton onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : state?.mode === 'edit' ? 'Lưu thay đổi' : 'Tạo dịch vụ'}
          </DialogActionButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInputField
          label="Mã dịch vụ *"
          placeholder="DV01"
          error={Boolean(errors.code)}
          helperText={errors.code?.message}
          {...register('code', { required: 'Bắt buộc' })}
        />

        <FormInputField
          label="Tên dịch vụ *"
          placeholder="Dịch vụ Google"
          error={Boolean(errors.name)}
          helperText={errors.name?.message}
          {...register('name', { required: 'Bắt buộc' })}
        />
      </div>

      <Controller
        name="parentId"
        control={control}
        render={({ field }) => (
          <FormSelectField label="Dịch vụ cha" {...field}>
            <MenuItem value="">Không có</MenuItem>
            {parentOptions
              .filter((option) => canUseAsParent(option, currentService))
              .map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {'— '.repeat(option.depth)}
                  {option.name}
                </MenuItem>
              ))}
          </FormSelectField>
        )}
      />

      <FormInputField multiline minRows={3} label="Nội dung" {...register('content')} />

      <div className="grid gap-4 md:grid-cols-2">
        <FormInputField
          multiline
          minRows={2}
          label="Nội dung hóa đơn"
          {...register('invoiceContent')}
        />

        <FormInputField
          multiline
          minRows={2}
          label="Thời điểm xuất hóa đơn"
          {...register('invoiceTiming')}
        />
      </div>
    </AppFormDialog>
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
    <AppFormDialog
      open={Boolean(state)}
      title="Cấu hình báo giá dịch vụ"
      maxWidth="sm"
      submitting={isSubmitting}
      onClose={onClose}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!state) return;
        await onSubmit(state.service, config, state.option);
        onClose();
      }}
      contentClassName="space-y-4"
      actions={
        <>
          <DialogActionButton onClick={resetDefaults} disabled={isSubmitting || !state}>
            Khôi phục mặc định
          </DialogActionButton>
          <div className="flex-1" />
          <DialogActionButton onClick={onClose} disabled={isSubmitting}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting || !state}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
          </DialogActionButton>
        </>
      }
    >
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
          {state?.service.code || '-'}
        </span>
        <p className="truncate text-sm font-semibold text-slate-900">
          {state?.service.name || 'Dịch vụ'}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 py-2.5">
        <p className="text-sm font-bold text-slate-950">Áp dụng tự động trong báo giá</p>
        <Switch
          checked={config.enabled}
          onChange={(event) =>
            setConfig((current) => ({ ...current, enabled: event.target.checked }))
          }
          slotProps={{ input: { 'aria-label': 'Áp dụng tự động trong báo giá' } }}
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <p className="text-sm font-bold text-slate-950">Phí quản lý theo ngân sách (%)</p>
        </div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
          {config.managementFeeRates.map((rate, index) => (
            <div
              key={rate.label}
              className="grid grid-cols-[minmax(0,1fr)_84px] items-center gap-3 bg-white px-3.5 py-2.5"
            >
              <span className="text-xs font-semibold text-slate-700">{rate.label}</span>
              <FormInputField
                type="number"
                value={rate.single}
                onChange={(event) => updateRate(index, 'single', event.target.value)}
                slotProps={{ htmlInput: { min: 0, className: 'text-right' } }}
                aria-label={`Phí quản lý ${rate.label}`}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-3 text-sm font-bold text-slate-950">Phí setup</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {config.setupPackages.map((setupPackage, index) => (
            <MoneyInput
              key={setupPackage.key}
              fullWidth
              size="small"
              label={setupPackage.label}
              value={setupPackage.price}
              onValueChange={(value) => updateSetupPackage(index, value)}
              className={compactFormFieldClassName}
            />
          ))}
        </div>
      </section>
    </AppFormDialog>
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
  const currentUser = useAuthStore((state) => state.user);
  const canManage = canManageCatalog(currentUser);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [quoteConfigDialogState, setQuoteConfigDialogState] =
    useState<QuoteConfigDialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeService, setActiveService] = useState<FlatServiceItem | null>(null);
  const flatServices = useMemo(() => flattenServices(services), [services]);
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

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, service: FlatServiceItem) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveService(service);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveService(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Dịch vụ"
        action={{
          label: 'Thêm dịch vụ',
          icon: <AddRoundedIcon />,
          onClick: () => setDialogState({ mode: 'create', parent: null }),
          disabled: !canManage,
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-slate-200 p-4">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm mã, tên, nội dung dịch vụ..."
            value={filters.keyword}
            onChange={(value) => updateFilters({ keyword: value })}
          />
        </div>

        <AppDataTable
          columns={[
            { key: 'service', label: 'Dịch vụ', className: 'w-[390px]' },
            { key: 'content', label: 'Nội dung', className: 'w-[260px]' },
            { key: 'invoiceContent', label: 'Nội dung hóa đơn', className: 'w-[260px]' },
            { key: 'invoiceTiming', label: 'Thời điểm hóa đơn', className: 'w-[220px]' },
            { key: 'actions', className: 'w-40' },
          ]}
          isLoading={isFetching}
          isEmpty={flatServices.length === 0}
          emptyText="Chưa có dịch vụ nào"
          minWidthClassName="min-w-[1080px]"
        >
          {flatServices.map((service) => {
            const color = rootColorMap.get(getRootServiceId(service)) || ROOT_COLOR_CLASSES[0];

            return (
              <tr key={service.id} className={`group border-l-4 ${color.row} hover:bg-slate-50/80`}>
                <td className={`px-3 py-4 ${service.depth > 0 ? color.child : ''}`}>
                  <div
                    className="flex min-w-0 items-center gap-2"
                    style={{ paddingLeft: service.depth * 24 }}
                  >
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${color.icon}`}
                    >
                      {service.depth === 0 ? (
                        <AccountTreeRoundedIcon className="!text-[16px]" />
                      ) : (
                        <SubdirectoryArrowRightRoundedIcon className="!text-[16px]" />
                      )}
                    </span>
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
                  </div>
                </td>
                <td className="px-3 py-4">
                  <p className="line-clamp-2 text-slate-600" title={service.content || ''}>
                    {service.content || '-'}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <p className="line-clamp-2 text-slate-600" title={service.invoiceContent || ''}>
                    {service.invoiceContent || '-'}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <p className="line-clamp-2 text-slate-600" title={service.invoiceTiming || ''}>
                    {service.invoiceTiming || '-'}
                  </p>
                </td>
                <td className="py-4">
                  <div className="flex items-center justify-end gap-1 pr-3">
                    {service.depth === 0 && (
                      <IconButton
                        size="small"
                        title="Cấu hình báo giá"
                        aria-label={`Cấu hình báo giá dịch vụ ${service.name}`}
                        disabled={isSavingQuoteConfig || !canManage}
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
                      aria-label={`Thêm dịch vụ con cho ${service.name}`}
                      disabled={!canManage}
                      onClick={() => setDialogState({ mode: 'create', parent: service })}
                    >
                      <AddRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Chỉnh sửa"
                      aria-label={`Chỉnh sửa dịch vụ ${service.name}`}
                      disabled={!canManage}
                      onClick={() => setDialogState({ mode: 'edit', service })}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Tác vụ"
                      aria-label={`Mở tác vụ dịch vụ ${service.name}`}
                      onClick={(event) => openActionMenu(event, service)}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </AppDataTable>

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
          {activeService?.depth === 0 && (
            <MenuItem
              disabled={isSavingQuoteConfig || !canManage}
              onClick={() => {
                if (activeService) {
                  setQuoteConfigDialogState({
                    service: activeService,
                    option: getConfigForRoot(quoteConfigs, activeService),
                  });
                }
                closeActionMenu();
              }}
            >
              <PriceCheckRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
              Cấu hình báo giá
            </MenuItem>
          )}
          <MenuItem
            disabled={!canManage}
            onClick={() => {
              if (activeService) setDialogState({ mode: 'create', parent: activeService });
              closeActionMenu();
            }}
          >
            <AddRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Thêm dịch vụ con
          </MenuItem>
          <MenuItem
            disabled={!canManage}
            onClick={() => {
              if (activeService) setDialogState({ mode: 'edit', service: activeService });
              closeActionMenu();
            }}
          >
            <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Chỉnh sửa
          </MenuItem>
          <MenuItem
            className="text-rose-600"
            disabled={isDeleting || !canManage}
            onClick={() => {
              if (activeService) setDeleteTarget(activeService);
              closeActionMenu();
            }}
          >
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>
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
