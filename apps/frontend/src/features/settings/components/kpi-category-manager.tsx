'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { applyApiErrorsToForm } from '@/lib/api-error';
import {
  getKpiCategoryDefaults,
  type KpiCategoryFormValues,
} from '@/lib/kpi-category-options';
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
    <Dialog open={Boolean(state)} onClose={isSubmitting ? undefined : closeDialog} maxWidth="sm" fullWidth>
      <DialogTitle className="border-b border-slate-100 px-5 py-4">
        <p className="text-base font-bold text-slate-950">
          {state?.mode === 'edit' ? 'Chỉnh sửa hạng mục' : 'Thêm hạng mục lỗi/thành tích'}
        </p>
      </DialogTitle>

      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            await onSubmit(values, category);
            closeDialog();
          } catch (error) {
            applyApiErrorsToForm(error, setError);
          }
        })}
      >
        <DialogContent className="grid gap-3 px-5 py-4 md:grid-cols-2">
          <TextField
            fullWidth
            label="Tên hiển thị *"
            className="md:col-span-2"
            error={Boolean(errors.label)}
            helperText={errors.label?.message}
            {...register('label', { required: 'Bắt buộc' })}
          />
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <TextField select fullWidth label="Loại *" {...field}>
                <MenuItem value="bonus">Thành tích (cộng điểm)</MenuItem>
                <MenuItem value="penalty">Lỗi (trừ điểm)</MenuItem>
              </TextField>
            )}
          />
          <TextField
            fullWidth
            type="number"
            label="Điểm mặc định *"
            error={Boolean(errors.defaultScore)}
            helperText={errors.defaultScore?.message}
            slotProps={{ htmlInput: { step: 0.5 } }}
            {...register('defaultScore', { required: 'Bắt buộc' })}
          />
          <div className="flex items-center gap-2 md:col-span-2">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
              )}
            />
            <span className="text-sm font-semibold text-slate-700">Đang áp dụng</span>
          </div>
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
            {isSubmitting ? 'Đang lưu...' : state?.mode === 'edit' ? 'Lưu thay đổi' : 'Tạo hạng mục'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Lỗi / Thành tích KPI</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Cài đặt</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Lỗi / Thành tích KPI</span>
          </div>
        </div>

        <Button
          type="button"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setDialogState({ mode: 'create' })}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Thêm hạng mục
        </Button>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[720px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Tên hiển thị</th>
                <th className="w-40 px-5 py-4">Loại</th>
                <th className="w-40 px-5 py-4 text-right">Điểm mặc định</th>
                <th className="w-32 px-5 py-4">Đang áp dụng</th>
                <th className="w-20 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có hạng mục lỗi/thành tích nào
                  </td>
                </tr>
              ) : (
                pageItems.map((option) => {
                  const category = kpiCategoryFromOption(option);

                  return (
                    <tr key={option.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        <span className="block truncate" title={category.label}>
                          {category.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${
                            category.type === 'bonus'
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-rose-50 text-rose-700 ring-rose-200'
                          }`}
                        >
                          {category.type === 'bonus' ? 'Thành tích' : 'Lỗi'}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-4 text-right font-extrabold tabular-nums ${category.defaultScore >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                      >
                        {category.defaultScore > 0 ? '+' : ''}
                        {category.defaultScore}
                      </td>
                      <td className="px-5 py-4">
                        {option.isActive !== false ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            Có
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <IconButton
                            size="small"
                            title="Tác vụ"
                            onClick={(event) => openActionMenu(event, option)}
                          >
                            <MoreVertRoundedIcon fontSize="small" />
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
