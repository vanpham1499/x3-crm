'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
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
  TextField,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { MoneyInput } from '@/components/form/money-input';
import { INVOICE_STATUS_LABELS, getInvoiceDefaults } from '@/lib/invoice-utils';
import { formatCurrency } from '@/lib/utils';
import type { Invoice, InvoiceFilters, InvoiceFormValues } from '@/types/invoice';
import type { Revenue } from '@/types/revenue';

type DialogState =
  | { mode: 'create'; invoice?: null; revenue?: Revenue | null }
  | { mode: 'edit'; invoice: Invoice; revenue?: null };

type InvoiceManagerProps = {
  invoices: Invoice[];
  revenues: Revenue[];
  filters: InvoiceFilters;
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onFiltersChange: (filters: InvoiceFilters) => void;
  onSubmit: (values: InvoiceFormValues, invoice?: Invoice | null) => void;
  onDelete: (invoice: Invoice) => void;
};

function statusClass(status?: string | null) {
  if (status === 'issued') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700 ring-rose-100';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function InvoiceFormDialog({
  state,
  revenues,
  invoices,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: DialogState | null;
  revenues: Revenue[];
  invoices: Invoice[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: InvoiceFormValues, invoice?: Invoice | null) => void;
}) {
  const currentInvoice = state?.mode === 'edit' ? state.invoice : null;
  const presetRevenue = state?.mode === 'create' ? state.revenue : null;
  const invoicedRevenueIds = new Set(invoices.map((invoice) => invoice.revenueId).filter(Boolean));
  const availableRevenues = revenues.filter(
    (revenue) => !invoicedRevenueIds.has(revenue.id) || String(revenue.id) === String(presetRevenue?.id),
  );

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    values: getInvoiceDefaults(currentInvoice, presetRevenue),
  });

  const selectedRevenueId = watch('revenueId');
  const selectedRevenue = revenues.find((revenue) => String(revenue.id) === selectedRevenueId);

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={Boolean(state)} onClose={isSubmitting ? undefined : closeDialog} maxWidth="md" fullWidth>
      <DialogTitle className="border-b border-slate-100 px-6 py-5">
        <p className="text-lg font-bold text-slate-950">
          {state?.mode === 'edit' ? 'Chỉnh sửa hóa đơn' : 'Xuất hóa đơn'}
        </p>
        <p className="mt-1 text-sm text-slate-500">Thông tin xuất hóa đơn gắn với 1 khoản doanh thu.</p>
      </DialogTitle>

      <form
        onSubmit={handleSubmit((values) => {
          onSubmit(values, currentInvoice);
          closeDialog();
        })}
      >
        <DialogContent className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <Controller
            name="revenueId"
            control={control}
            rules={{ required: 'Vui lòng chọn doanh thu' }}
            render={({ field }) => (
              <TextField
                fullWidth
                select
                label="Doanh thu *"
                className="md:col-span-2"
                disabled={state?.mode === 'edit'}
                error={Boolean(errors.revenueId)}
                helperText={errors.revenueId?.message}
                {...field}
              >
                {availableRevenues.map((revenue) => (
                  <MenuItem key={revenue.id} value={String(revenue.id)}>
                    {revenue.revenueCode} — {revenue.project?.projectName} —{' '}
                    {formatCurrency(Number(revenue.amountAfterVat) || 0)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {selectedRevenue ? (
            <p className="-mt-2 text-xs text-slate-400 md:col-span-2">
              Dự án: {selectedRevenue.project?.projectName || '-'} · Khách hàng:{' '}
              {selectedRevenue.project?.customer?.customerName || '-'}
            </p>
          ) : null}

          <TextField fullWidth select label="Loại hóa đơn" {...register('invoiceType')}>
            <MenuItem value="vat">Hóa đơn VAT</MenuItem>
            <MenuItem value="receipt">Biên lai</MenuItem>
          </TextField>

          <TextField
            fullWidth
            label="Số hóa đơn"
            placeholder="Hệ thống tự tạo nếu để trống"
            {...register('invoiceNo')}
          />

          <Controller
            name="issuedDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Ngày xuất"
                value={field.value ? dayjs(field.value) : null}
                onChange={(nextValue) =>
                  field.onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM-DD') : '')
                }
                slotProps={{ textField: { fullWidth: true } }}
              />
            )}
          />

          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <TextField fullWidth select label="Tình trạng" {...field}>
                {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          <TextField fullWidth label="Tên công ty xuất hóa đơn" {...register('companyName')} />
          <TextField fullWidth label="Mã số thuế" {...register('taxCode')} />
          <TextField fullWidth multiline minRows={2} label="Địa chỉ" {...register('address')} />
          <TextField fullWidth label="Email nhận hóa đơn" {...register('receiverEmail')} />

          <Controller
            name="amountBeforeVat"
            control={control}
            render={({ field }) => (
              <MoneyInput fullWidth label="Tiền trước VAT" value={field.value} onValueChange={field.onChange} />
            )}
          />
          <Controller
            name="vatAmount"
            control={control}
            render={({ field }) => (
              <MoneyInput fullWidth label="Tiền VAT" value={field.value} onValueChange={field.onChange} />
            )}
          />
          <Controller
            name="amountAfterVat"
            control={control}
            render={({ field }) => (
              <MoneyInput fullWidth label="Tổng tiền hóa đơn" value={field.value} onValueChange={field.onChange} />
            )}
          />

          <TextField fullWidth label="Link file hóa đơn" {...register('fileUrl')} />
          <TextField fullWidth multiline minRows={2} label="Ghi chú" className="md:col-span-2" {...register('note')} />
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
            {isSubmitting ? 'Đang lưu...' : state?.mode === 'edit' ? 'Lưu thay đổi' : 'Xuất hóa đơn'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function InvoiceManager({
  invoices,
  revenues,
  filters,
  isFetching,
  isSubmitting,
  isDeleting,
  onFiltersChange,
  onSubmit,
  onDelete,
}: InvoiceManagerProps) {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const updateFilters = (nextFilters: Partial<InvoiceFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const invoicedRevenueIds = useMemo(
    () => new Set(invoices.map((invoice) => invoice.revenueId).filter(Boolean)),
    [invoices],
  );
  const hasUninvoicedRevenue = revenues.some((revenue) => !invoicedRevenueIds.has(revenue.id));

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Hóa đơn</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Hóa đơn</span>
          </div>
        </div>

        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          disabled={!hasUninvoicedRevenue}
          title={hasUninvoicedRevenue ? '' : 'Tất cả doanh thu hiện có đã được xuất hóa đơn'}
          onClick={() => setDialogState({ mode: 'create', revenue: null })}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Xuất hóa đơn
        </Button>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[minmax(260px,1fr)_200px]">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm số hóa đơn, tên công ty, MST..."
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
            label="Tình trạng"
            value={filters.status}
            onChange={(event) => updateFilters({ status: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </div>

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress />
            </div>
          )}

          <table className={`w-full min-w-[1200px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-40 px-5 py-4">Số hóa đơn</th>
                <th className="w-52 px-5 py-4">Khách hàng / Dự án</th>
                <th className="w-32 px-5 py-4">Ngày xuất</th>
                <th className="w-40 px-5 py-4 text-right">Tổng tiền</th>
                <th className="w-32 px-5 py-4">Tình trạng</th>
                <th className="w-20 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có hóa đơn nào
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-bold text-slate-950">
                      <p>{invoice.invoiceNo || '-'}</p>
                      {invoice.revenue ? (
                        <Link
                          href={`/revenues/${invoice.revenue.id}`}
                          className="mt-1 block text-xs font-normal text-slate-400 hover:underline"
                        >
                          {invoice.revenue.revenueCode}
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <p className="truncate font-semibold text-slate-900">{invoice.companyName || '-'}</p>
                      {invoice.revenue?.project ? (
                        <Link
                          href={`/projects/${invoice.revenue.project.id}`}
                          className="mt-1 block truncate text-xs text-slate-500 hover:underline"
                        >
                          {invoice.revenue.project.projectName || '-'}
                        </Link>
                      ) : (
                        <p className="mt-1 truncate text-xs text-slate-500">-</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{invoice.issuedDate || '-'}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-950">
                      {formatCurrency(Number(invoice.amountAfterVat) || 0)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(invoice.status)}`}>
                        {INVOICE_STATUS_LABELS[invoice.status || ''] || invoice.status || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          size="small"
                          title="Chỉnh sửa"
                          onClick={() => setDialogState({ mode: 'edit', invoice })}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Xóa"
                          className="hover:text-rose-600"
                          onClick={() => setDeleteTarget(invoice)}
                        >
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <InvoiceFormDialog
        state={dialogState}
        revenues={revenues}
        invoices={invoices}
        isSubmitting={isSubmitting}
        onClose={() => setDialogState(null)}
        onSubmit={(values, invoice) => onSubmit(values, invoice)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa hóa đơn?"
        description={`Bạn có chắc muốn xóa hóa đơn "${deleteTarget?.invoiceNo || ''}"?`}
        confirmText="Xóa hóa đơn"
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
