'use client';

import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { applyApiErrorsToForm } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Customer } from '@/types/customer';
import type { KpiCategory, KpiPoint, KpiPointFilters, KpiPointFormValues } from '@/types/kpi';
import type { User } from '@/types/user';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

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
  const selectedCategory = watch('category');
  const categoryMeta = categories.find((category) => category.key === selectedCategory) || null;
  const selectedUserId = watch('userId');

  const { data: customers = [], isFetching: isCustomersFetching } = useQuery<Customer[]>({
    queryKey: ['customers', 'sales-user', selectedUserId],
    queryFn: () =>
      api
        .get<Customer[]>('/customers', { params: { sales_user_id: selectedUserId } })
        .then((response) => response.data),
    enabled: Boolean(selectedUserId),
  });

  useEffect(() => {
    const codes = customers
      .map((customer) => customer.customerCode)
      .filter(Boolean)
      .join(', ');
    setValue('customerRef', codes);
  }, [customers, setValue]);

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : closeDialog} maxWidth="sm" fullWidth>
      <DialogTitle className="border-b border-slate-100 px-5 py-4">
        <p className="text-base font-bold text-slate-950">Ghi nhận điểm KPI</p>
      </DialogTitle>

      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            await onSubmit(values);
            closeDialog();
          } catch (error) {
            applyApiErrorsToForm(error, setError);
          }
        })}
      >
        <DialogContent className="grid gap-3 px-5 py-4 md:grid-cols-2">
          <Controller
            name="userId"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Autocomplete
                className="md:col-span-2"
                options={users}
                value={users.find((user) => String(user.id) === field.value) || null}
                onChange={(_, value) => field.onChange(value ? String(value.id) : '')}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Nhân viên *"
                    error={Boolean(errors.userId)}
                    helperText={errors.userId?.message}
                  />
                )}
              />
            )}
          />
          <input type="hidden" {...register('customerRef')} />
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mã khách hàng</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {!selectedUserId
                ? 'Chọn nhân viên trước'
                : isCustomersFetching
                  ? 'Đang tải...'
                  : customers.length > 0
                    ? customers.map((customer) => customer.customerCode).filter(Boolean).join(', ')
                    : 'Nhân viên chưa phụ trách khách hàng nào'}
            </p>
          </div>
          <Controller
            name="category"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                select
                fullWidth
                label="Lỗi / Thành tích *"
                className="md:col-span-2"
                error={Boolean(errors.category)}
                helperText={errors.category?.message}
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  const meta = categories.find((category) => category.key === event.target.value);
                  if (meta) setValue('score', String(meta.defaultScore));
                }}
              >
                <MenuItem value="">Chưa chọn</MenuItem>
                {categories.map((meta) => (
                  <MenuItem key={meta.key} value={meta.key}>
                    {meta.label} ({meta.type === 'bonus' ? '+' : ''}
                    {meta.defaultScore})
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <TextField
            fullWidth
            type="number"
            label="Điểm số *"
            error={Boolean(errors.score)}
            helperText={
              errors.score?.message ||
              (categoryMeta ? `Mặc định: ${categoryMeta.defaultScore}` : undefined)
            }
            slotProps={{ htmlInput: { step: 0.5 } }}
            {...register('score', { required: true })}
          />
          <TextField
            fullWidth
            type="date"
            label="Ngày ghi nhận *"
            error={Boolean(errors.entryDate)}
            helperText={errors.entryDate?.message}
            slotProps={{ inputLabel: { shrink: true } }}
            {...register('entryDate', { required: true })}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Ghi chú / Minh chứng"
            className="md:col-span-2"
            {...register('note')}
          />
        </DialogContent>

        <DialogActions className="border-t border-slate-100 px-5 py-3">
          <Button size="small" variant="outlined" onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            size="small"
            variant="contained"
            disabled={isSubmitting}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu điểm KPI'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function KpiManager({
  points,
  users,
  categories,
  filters,
  isFetching,
  isSaving,
  isDeleting,
  isApproving,
  canApprove,
  onFiltersChange,
  onSave,
  onDelete,
  onApprove,
}: {
  points: KpiPoint[];
  users: User[];
  categories: KpiCategory[];
  filters: KpiPointFilters;
  isFetching: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isApproving: boolean;
  canApprove: boolean;
  onFiltersChange: (filters: KpiPointFilters) => void;
  onSave: (values: KpiPointFormValues) => Promise<unknown>;
  onDelete: (point: KpiPoint) => void;
  onApprove: (point: KpiPoint) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KpiPoint | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(points, {
    resetKey: filters,
  });

  const updateFilters = (next: Partial<KpiPointFilters>) => {
    onFiltersChange({ ...filters, ...next });
  };

  const summaryByUser = useMemo(() => {
    const map = new Map<number, { name: string; total: number; count: number }>();
    points.forEach((point) => {
      const key = point.userId;
      const existing = map.get(key) || {
        name: point.user?.name || `NV #${key}`,
        total: 0,
        count: 0,
      };
      existing.total += Number(point.score) || 0;
      existing.count += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [points]);

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">KPI nhân viên</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">KPI</span>
          </div>
        </div>

        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setDialogOpen(true)}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Ghi nhận điểm KPI
        </Button>
      </div>

      {summaryByUser.length > 0 && (
        <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-bold text-slate-950">Tổng điểm theo nhân viên (theo bộ lọc)</h2>
          </div>
          <div className="flex flex-wrap gap-3 p-4">
            {summaryByUser.map((row) => (
              <div
                key={row.name}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5"
              >
                <p className="text-xs font-bold text-slate-500">{row.name}</p>
                <p
                  className={`mt-0.5 text-lg font-extrabold tabular-nums ${row.total >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                >
                  {row.total > 0 ? '+' : ''}
                  {row.total} <span className="text-xs font-semibold text-slate-400">({row.count} mục)</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-4">
          <Autocomplete
            options={users}
            value={users.find((user) => String(user.id) === filters.userId) || null}
            onChange={(_, value) => updateFilters({ userId: value ? String(value.id) : '' })}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Nhân viên" />}
          />
          <TextField
            select
            fullWidth
            label="Loại"
            value={filters.type}
            onChange={(event) => updateFilters({ type: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="bonus">Thành tích</MenuItem>
            <MenuItem value="penalty">Lỗi</MenuItem>
          </TextField>
          <TextField
            fullWidth
            type="date"
            label="Từ ngày"
            value={filters.dateFrom}
            onChange={(event) => updateFilters({ dateFrom: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            fullWidth
            type="date"
            label="Đến ngày"
            value={filters.dateTo}
            onChange={(event) => updateFilters({ dateTo: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </div>

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[1180px] text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Ngày</th>
                <th className="px-5 py-4">Nhân viên</th>
                <th className="px-5 py-4">Lỗi / Thành tích</th>
                <th className="px-5 py-4 text-right">Điểm</th>
                <th className="px-5 py-4">Mã khách</th>
                <th className="px-5 py-4">Ghi chú</th>
                <th className="px-5 py-4">Duyệt</th>
                <th className="w-20 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {points.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có dữ liệu KPI
                  </td>
                </tr>
              ) : (
                pageItems.map((point) => (
                  <tr key={point.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {formatDate(point.entryDate)}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-950">{point.user?.name || '-'}</td>
                    <td className="px-5 py-4 text-slate-700">
                      {point.categoryLabel || point.category}
                    </td>
                    <td
                      className={`px-5 py-4 text-right font-extrabold tabular-nums ${Number(point.score) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                      {Number(point.score) > 0 ? '+' : ''}
                      {point.score}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{point.customerRef || '-'}</td>
                    <td className="max-w-[220px] truncate px-5 py-4 text-slate-600" title={point.note || ''}>
                      {point.note || '-'}
                    </td>
                    <td className="px-5 py-4">
                      {point.isApproved ? (
                        <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                          Đã duyệt
                        </span>
                      ) : canApprove ? (
                        <IconButton
                          size="small"
                          title="Duyệt"
                          disabled={isApproving}
                          onClick={() => onApprove(point)}
                        >
                          <CheckCircleOutlineRoundedIcon fontSize="small" className="text-slate-400" />
                        </IconButton>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">Chờ duyệt</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <IconButton
                          size="small"
                          title="Xóa"
                          disabled={isDeleting}
                          onClick={() => setDeleteTarget(point)}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))
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
