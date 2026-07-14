'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { Autocomplete, IconButton, Menu, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactAutocompleteField } from '@/components/form/compact-autocomplete-field';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { applyApiErrorsToForm } from '@/lib/api-error';
import { formatDate } from '@/lib/utils';
import api from '@/services/api/client';
import type { Customer } from '@/types/customer';
import type {
  KpiCategory,
  KpiPoint,
  KpiPointFilters,
  KpiPointFormValues,
  KpiPointSummary,
} from '@/types/kpi';
import type { User } from '@/types/user';

function getDefaults(userId: string): KpiPointFormValues {
  return {
    userId,
    entryDate: new Date().toISOString().slice(0, 10),
    category: '',
    score: '',
    customerRef: '',
    note: '',
  };
}

function KpiDialog({
  open,
  users,
  categories,
  defaultUserId,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  users: User[];
  categories: KpiCategory[];
  defaultUserId: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: KpiPointFormValues) => Promise<unknown>;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<KpiPointFormValues>({
    values: getDefaults(defaultUserId),
  });
  const selectedUserId = watch('userId');

  const { data: customers = [], isFetching: isCustomersFetching } = useQuery<Customer[]>({
    queryKey: ['customers', 'sales-user', selectedUserId],
    queryFn: () =>
      api
        .get<Customer[]>('/customers', { params: { sales_user_id: selectedUserId } })
        .then((response) => response.data),
    enabled: Boolean(selectedUserId),
  });

  const customerCodes = useMemo(
    () =>
      customers
        .map((customer) => customer.customerCode)
        .filter(Boolean)
        .join(', '),
    [customers],
  );

  useEffect(() => {
    setValue('customerRef', customerCodes);
  }, [customerCodes, setValue]);

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <AppFormDialog
      open={open}
      title="Ghi nhận điểm KPI"
      maxWidth="sm"
      submitting={isSubmitting}
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      actions={
        <>
          <DialogActionButton disabled={isSubmitting} onClick={closeDialog}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu điểm KPI'}
          </DialogActionButton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          name="userId"
          control={control}
          rules={{ required: 'Vui lòng chọn nhân viên' }}
          render={({ field }) => (
            <Autocomplete
              className="md:col-span-2"
              options={users}
              value={users.find((user) => String(user.id) === field.value) || null}
              onChange={(_, value) => field.onChange(value ? String(value.id) : '')}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="Không tìm thấy nhân viên"
              renderInput={(params) => (
                <FormInputField
                  {...params}
                  required
                  label="Nhân viên"
                  error={Boolean(errors.userId)}
                  helperText={errors.userId?.message}
                />
              )}
            />
          )}
        />

        <input type="hidden" {...register('customerRef')} />
        <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
          <span className="shrink-0 text-sm font-semibold text-slate-500">Mã khách hàng</span>
          <span
            className="min-w-0 truncate text-right text-sm font-bold text-slate-800"
            title={customerCodes || undefined}
          >
            {!selectedUserId
              ? 'Chưa chọn nhân viên'
              : isCustomersFetching
                ? 'Đang tải...'
                : customerCodes || 'Chưa phụ trách khách hàng'}
          </span>
        </div>

        <Controller
          name="category"
          control={control}
          rules={{ required: 'Vui lòng chọn hạng mục' }}
          render={({ field }) => (
            <FormSelectField
              required
              label="Lỗi / Thành tích"
              className="md:col-span-2"
              error={Boolean(errors.category)}
              helperText={errors.category?.message}
              {...field}
              onChange={(event) => {
                field.onChange(event);
                const category = categories.find((item) => item.key === event.target.value);
                if (category) setValue('score', String(category.defaultScore));
              }}
            >
              <MenuItem value="">Chưa chọn</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.key} value={category.key}>
                  {category.label} ({category.type === 'bonus' ? '+' : ''}
                  {category.defaultScore})
                </MenuItem>
              ))}
            </FormSelectField>
          )}
        />

        <FormInputField
          required
          type="number"
          label="Điểm số"
          error={Boolean(errors.score)}
          helperText={errors.score?.message}
          slotProps={{ htmlInput: { step: 0.5 } }}
          {...register('score', { required: 'Vui lòng nhập điểm số' })}
        />

        <Controller
          name="entryDate"
          control={control}
          rules={{ required: 'Vui lòng chọn ngày ghi nhận' }}
          render={({ field }) => (
            <FormDatePicker
              required
              label="Ngày ghi nhận"
              value={field.value}
              error={Boolean(errors.entryDate)}
              helperText={errors.entryDate?.message}
              onChange={field.onChange}
            />
          )}
        />

        <FormInputField
          multiline
          minRows={2}
          label="Ghi chú / Minh chứng"
          className="md:col-span-2"
          {...register('note')}
        />
      </div>
    </AppFormDialog>
  );
}

export function KpiManager({
  points,
  summary,
  users,
  categories,
  filters,
  isFetching,
  isSaving,
  isDeleting,
  isApproving,
  canApprove,
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onSave,
  onDelete,
  onApprove,
}: {
  points: KpiPoint[];
  summary: KpiPointSummary[];
  users: User[];
  categories: KpiCategory[];
  filters: KpiPointFilters;
  isFetching: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isApproving: boolean;
  canApprove: boolean;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFiltersChange: (filters: KpiPointFilters) => void;
  onSave: (values: KpiPointFormValues) => Promise<unknown>;
  onDelete: (point: KpiPoint) => void;
  onApprove: (point: KpiPoint) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activePoint, setActivePoint] = useState<KpiPoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KpiPoint | null>(null);
  const updateFilters = (next: Partial<KpiPointFilters>) => {
    onFiltersChange({ ...filters, ...next });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, point: KpiPoint) => {
    setMenuAnchorEl(event.currentTarget);
    setActivePoint(point);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActivePoint(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="KPI nhân viên"
        action={{
          label: 'Ghi nhận điểm KPI',
          icon: <AddRoundedIcon />,
          onClick: () => setDialogOpen(true),
        }}
      />

      {summary.length > 0 && (
        <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-12 items-center border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-950">Tổng điểm theo bộ lọc</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {summary.map((row) => (
              <div
                key={row.userId}
                className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <p className="truncate text-xs font-bold text-slate-600" title={row.name}>
                  {row.name}
                </p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p
                    className={`text-lg font-extrabold tabular-nums ${row.total >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                  >
                    {row.total > 0 ? '+' : ''}
                    {row.total}
                  </p>
                  <span className="pb-0.5 text-xs font-semibold text-slate-400">
                    {row.count} mục
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_150px_160px_160px]">
          <CompactAutocompleteField
            label="Nhân viên"
            value={filters.userId}
            allLabel="Tất cả nhân viên"
            options={users.map((user) => ({ value: String(user.id), label: user.name }))}
            onChange={(userId) => updateFilters({ userId })}
          />
          <CompactAutocompleteField
            label="Hạng mục KPI"
            value={filters.category}
            allLabel="Tất cả hạng mục"
            options={categories.map((category) => ({
              value: category.key,
              label: category.label,
            }))}
            onChange={(category) => updateFilters({ category })}
          />
          <CompactSelectField
            label="Loại"
            value={filters.type}
            options={[
              { value: 'bonus', label: 'Thành tích' },
              { value: 'penalty', label: 'Lỗi' },
            ]}
            onChange={(type) => updateFilters({ type })}
          />
          <FormDatePicker
            label="Từ ngày"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(dateFrom) => updateFilters({ dateFrom })}
          />
          <FormDatePicker
            label="Đến ngày"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(dateTo) => updateFilters({ dateTo })}
          />
        </div>

        <AppDataTable
          columns={[
            { key: 'date', label: 'Ngày', className: 'w-[120px]' },
            { key: 'user', label: 'Nhân viên', className: 'w-[180px]' },
            { key: 'category', label: 'Lỗi / Thành tích', className: 'w-[300px]' },
            { key: 'score', label: 'Điểm', className: 'w-[100px] text-right' },
            { key: 'customer', label: 'Mã khách', className: 'w-[180px]' },
            { key: 'note', label: 'Ghi chú', className: 'w-[220px]' },
            { key: 'approval', label: 'Duyệt', className: 'w-[120px]' },
            { key: 'actions', className: 'w-[56px]' },
          ]}
          isLoading={isFetching}
          isEmpty={points.length === 0}
          emptyText="Chưa có dữ liệu KPI"
          minWidthClassName="min-w-[1210px]"
        >
          {points.map((point) => {
            const score = Number(point.score) || 0;

            return (
              <tr key={point.id} className="hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-3 py-3.5 font-semibold text-slate-800">
                  {formatDate(point.entryDate)}
                </td>
                <td className="truncate px-3 py-3.5 font-bold text-slate-900">
                  {point.user?.name || '-'}
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${
                        point.type === 'bonus'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-rose-50 text-rose-700 ring-rose-200'
                      }`}
                    >
                      {point.type === 'bonus' ? 'Thành tích' : 'Lỗi'}
                    </span>
                    <span
                      className="min-w-0 truncate font-medium text-slate-700"
                      title={point.categoryLabel || point.category}
                    >
                      {point.categoryLabel || point.category}
                    </span>
                  </div>
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-3.5 text-right font-extrabold tabular-nums ${
                    score >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {score > 0 ? '+' : ''}
                  {point.score}
                </td>
                <td
                  className="truncate px-3 py-3.5 font-medium text-slate-600"
                  title={point.customerRef || undefined}
                >
                  {point.customerRef || '-'}
                </td>
                <td className="truncate px-3 py-3.5 text-slate-600" title={point.note || undefined}>
                  {point.note || '-'}
                </td>
                <td className="px-3 py-3.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ring-1 ${
                      point.isApproved
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-amber-50 text-amber-700 ring-amber-200'
                    }`}
                  >
                    {point.isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                  </span>
                </td>
                <td className="px-3 py-3.5 text-right">
                  <IconButton
                    size="small"
                    title="Tác vụ"
                    aria-label={`Tác vụ KPI của ${point.user?.name || 'nhân viên'}`}
                    onClick={(event) => openActionMenu(event, point)}
                  >
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                </td>
              </tr>
            );
          })}
        </AppDataTable>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        {activePoint && !activePoint.isApproved && canApprove && (
          <MenuItem
            disabled={isApproving}
            onClick={() => {
              onApprove(activePoint);
              closeActionMenu();
            }}
          >
            <CheckCircleOutlineRoundedIcon fontSize="small" className="mr-2 text-emerald-600" />
            Duyệt điểm KPI
          </MenuItem>
        )}
        <MenuItem
          className="text-rose-600"
          disabled={isDeleting}
          onClick={() => {
            setDeleteTarget(activePoint);
            closeActionMenu();
          }}
        >
          <DeleteOutlineRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <KpiDialog
        open={dialogOpen}
        users={users}
        categories={categories}
        defaultUserId={filters.userId}
        isSubmitting={isSaving}
        onClose={() => setDialogOpen(false)}
        onSubmit={onSave}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa điểm KPI?"
        description="Điểm KPI này sẽ bị xóa vĩnh viễn."
        confirmText="Xóa"
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
