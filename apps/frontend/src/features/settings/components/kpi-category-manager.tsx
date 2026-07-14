'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { IconButton, Menu, MenuItem, Switch } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { applyApiErrorsToForm } from '@/lib/api-error';
import { getKpiCategoryDefaults, type KpiCategoryFormValues } from '@/lib/kpi-category-options';
import { kpiCategoryFromOption } from '@/types/kpi';
import type { AppOption } from '@/types/option';

type KpiCategoryManagerProps = {
  categories: AppOption[];
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onSubmit: (values: KpiCategoryFormValues, category?: AppOption | null) => Promise<unknown>;
  onDelete: (category: AppOption) => void;
};

type DialogState = { mode: 'create'; category?: null } | { mode: 'edit'; category: AppOption };

function CategoryDialog({
  state,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: DialogState | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: KpiCategoryFormValues, category?: AppOption | null) => Promise<unknown>;
}) {
  const category = state?.mode === 'edit' ? state.category : null;
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<KpiCategoryFormValues>({
    values: getKpiCategoryDefaults(category),
  });

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <AppFormDialog
      open={Boolean(state)}
      title={state?.mode === 'edit' ? 'Chỉnh sửa hạng mục KPI' : 'Thêm hạng mục KPI'}
      maxWidth="sm"
      submitting={isSubmitting}
      contentClassName="space-y-4"
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values, category);
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
            {isSubmitting
              ? 'Đang lưu...'
              : state?.mode === 'edit'
                ? 'Lưu thay đổi'
                : 'Tạo hạng mục'}
          </DialogActionButton>
        </>
      }
    >
      <FormInputField
        label="Tên hạng mục *"
        error={Boolean(errors.label)}
        helperText={errors.label?.message}
        {...register('label', { required: 'Vui lòng nhập tên hạng mục' })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <FormSelectField label="Loại *" {...field}>
              <MenuItem value="bonus">Thành tích (cộng điểm)</MenuItem>
              <MenuItem value="penalty">Lỗi (trừ điểm)</MenuItem>
            </FormSelectField>
          )}
        />
        <FormInputField
          type="number"
          label="Điểm mặc định *"
          error={Boolean(errors.defaultScore)}
          helperText={errors.defaultScore?.message}
          slotProps={{ htmlInput: { step: 0.5 } }}
          {...register('defaultScore', { required: 'Vui lòng nhập điểm mặc định' })}
        />
      </div>

      <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-1.5">
        <span className="text-sm font-semibold text-slate-700">Đang áp dụng</span>
        <Controller
          name="isActive"
          control={control}
          render={({ field }) => (
            <Switch
              size="small"
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
              slotProps={{ input: { 'aria-label': 'Đang áp dụng hạng mục KPI' } }}
            />
          )}
        />
      </label>
    </AppFormDialog>
  );
}

export function KpiCategoryManager({
  categories,
  isFetching,
  isSubmitting,
  isDeleting,
  onSubmit,
  onDelete,
}: KpiCategoryManagerProps) {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppOption | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeCategory, setActiveCategory] = useState<AppOption | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(categories);

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, category: AppOption) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveCategory(category);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveCategory(null);
  };

  const editActiveCategory = () => {
    if (activeCategory) setDialogState({ mode: 'edit', category: activeCategory });
    closeActionMenu();
  };

  const deleteActiveCategory = () => {
    if (activeCategory) setDeleteTarget(activeCategory);
    closeActionMenu();
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Hạng mục KPI"
        action={{
          label: 'Thêm hạng mục',
          icon: <AddRoundedIcon />,
          onClick: () => setDialogState({ mode: 'create' }),
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <AppDataTable
          columns={[
            { key: 'name', label: 'Hạng mục' },
            { key: 'type', label: 'Loại', className: 'w-52' },
            { key: 'score', label: 'Điểm mặc định', className: 'w-44 text-right' },
            { key: 'status', label: 'Trạng thái', className: 'w-40' },
            { key: 'actions', className: 'w-24' },
          ]}
          isLoading={isFetching}
          isEmpty={pageItems.length === 0}
          emptyText="Chưa có hạng mục KPI"
          minWidthClassName="min-w-[760px]"
        >
          {pageItems.map((option) => {
            const category = kpiCategoryFromOption(option);

            return (
              <tr key={option.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-4">
                  <span
                    className="block truncate font-semibold text-slate-900"
                    title={category.label}
                  >
                    {category.label}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${
                      category.type === 'bonus'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        : 'bg-rose-50 text-rose-700 ring-rose-100'
                    }`}
                  >
                    {category.type === 'bonus' ? 'Thành tích' : 'Lỗi'}
                  </span>
                </td>
                <td
                  className={`px-3 py-4 text-right font-bold tabular-nums ${category.defaultScore >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                >
                  {category.defaultScore > 0 ? '+' : ''}
                  {category.defaultScore}
                </td>
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${
                      option.isActive !== false
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        : 'bg-slate-100 text-slate-600 ring-slate-200'
                    }`}
                  >
                    {option.isActive !== false ? 'Đang áp dụng' : 'Ngừng áp dụng'}
                  </span>
                </td>
                <td className="py-4">
                  <div className="flex items-center justify-end gap-1 pr-3">
                    <IconButton
                      size="small"
                      aria-label={`Chỉnh sửa hạng mục ${category.label}`}
                      title="Chỉnh sửa"
                      disabled={isSubmitting}
                      onClick={() => setDialogState({ mode: 'edit', category: option })}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Mở tác vụ hạng mục ${category.label}`}
                      title="Tác vụ"
                      onClick={(event) => openActionMenu(event, option)}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </div>
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
          onPageChange={setPage}
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem onClick={editActiveCategory}>
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem onClick={deleteActiveCategory} className="text-rose-600" disabled={isDeleting}>
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <CategoryDialog
        state={dialogState}
        isSubmitting={isSubmitting}
        onClose={() => setDialogState(null)}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa hạng mục?"
        description={`Bạn có chắc muốn xóa hạng mục "${deleteTarget?.label || ''}"? Các điểm KPI đã ghi nhận trước đó sẽ vẫn giữ nguyên nhưng không còn liên kết với hạng mục này.`}
        confirmText="Xóa hạng mục"
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
