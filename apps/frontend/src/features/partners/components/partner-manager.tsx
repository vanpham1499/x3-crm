'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
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
  Menu,
  MenuItem,
  TextField,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { applyApiErrorsToForm } from '@/lib/api-error';
import {
  getPartnerMetaValue,
  getProjectPartnerDefaults,
  type ProjectPartnerFormValues,
} from '@/lib/project-partner-options';
import type { AppOption } from '@/types/option';

type PartnerManagerProps = {
  partners: AppOption[];
  keyword: string;
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onKeywordChange: (keyword: string) => void;
  onSubmit: (values: ProjectPartnerFormValues, partner?: AppOption | null) => Promise<unknown>;
  onDelete: (partner: AppOption) => void;
};

type DialogState =
  | { mode: 'create'; partner?: null }
  | { mode: 'edit'; partner: AppOption };

function PartnerDialog({
  state,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: DialogState | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectPartnerFormValues, partner?: AppOption | null) => Promise<unknown>;
}) {
  const partner = state?.mode === 'edit' ? state.partner : null;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProjectPartnerFormValues>({
    values: getProjectPartnerDefaults(partner),
  });

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={Boolean(state)} onClose={isSubmitting ? undefined : closeDialog} maxWidth="md" fullWidth>
      <DialogTitle className="border-b border-slate-100 px-6 py-5">
        <p className="text-lg font-bold text-slate-950">
          {state?.mode === 'edit' ? 'Chỉnh sửa đối tác' : 'Thêm đối tác'}
        </p>
        <p className="mt-1 text-sm text-slate-500">Thông tin đối tác được lưu trong option dự án.</p>
      </DialogTitle>

      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            await onSubmit(values, partner);
            closeDialog();
          } catch (error) {
            applyApiErrorsToForm(error, setError);
          }
        })}
      >
        <DialogContent className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <TextField
            fullWidth
            label="Mã đối tác *"
            error={Boolean(errors.code)}
            helperText={errors.code?.message}
            {...register('code', { required: 'Bắt buộc' })}
          />
          <TextField
            fullWidth
            label="Tên đối tác *"
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
            {...register('name', { required: 'Bắt buộc' })}
          />
          <TextField fullWidth label="STK" {...register('accountNo')} />
          <TextField fullWidth label="Ngân hàng" {...register('bankName')} />
          <TextField fullWidth label="Dịch vụ" className="md:col-span-2" {...register('service')} />
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
            {isSubmitting ? 'Đang lưu...' : state?.mode === 'edit' ? 'Lưu thay đổi' : 'Tạo đối tác'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function PartnerManager({
  partners,
  keyword,
  isFetching,
  isSubmitting,
  isDeleting,
  onKeywordChange,
  onSubmit,
  onDelete,
}: PartnerManagerProps) {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppOption | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activePartner, setActivePartner] = useState<AppOption | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(partners, {
    resetKey: keyword,
  });

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, partner: AppOption) => {
    setMenuAnchorEl(event.currentTarget);
    setActivePartner(partner);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActivePartner(null);
  };

  const editActivePartner = () => {
    if (activePartner) setDialogState({ mode: 'edit', partner: activePartner });
    closeActionMenu();
  };

  const deleteActivePartner = () => {
    if (activePartner) setDeleteTarget(activePartner);
    closeActionMenu();
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Đối tác</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Dự án</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Đối tác</span>
          </div>
        </div>

        <Button
          type="button"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setDialogState({ mode: 'create' })}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Thêm đối tác
        </Button>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm mã đối tác, tên đối tác, STK, ngân hàng, dịch vụ..."
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
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
        </div>

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[980px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-36 px-5 py-4">Mã đối tác</th>
                <th className="w-[260px] px-5 py-4">Tên đối tác</th>
                <th className="w-44 px-5 py-4">STK</th>
                <th className="w-52 px-5 py-4">Ngân hàng</th>
                <th className="px-5 py-4">Dịch vụ</th>
                <th className="w-20 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có dữ liệu đối tác
                  </td>
                </tr>
              ) : (
                pageItems.map((partner) => (
                  <tr key={partner.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-bold text-slate-950">
                      <span className="block truncate" title={partner.key || ''}>
                        {partner.key || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      <span className="block truncate" title={partner.label}>
                        {partner.label || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <span className="block truncate" title={getPartnerMetaValue(partner, 'accountNo')}>
                        {getPartnerMetaValue(partner, 'accountNo') || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <span className="block truncate" title={getPartnerMetaValue(partner, 'bankName')}>
                        {getPartnerMetaValue(partner, 'bankName') || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <span className="block truncate" title={partner.value || ''}>
                        {partner.value || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <IconButton size="small" title="Tác vụ" onClick={(event) => openActionMenu(event, partner)}>
                          <MoreVertRoundedIcon fontSize="small" />
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

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem onClick={editActivePartner}>
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem onClick={deleteActivePartner} className="text-rose-600" disabled={isDeleting}>
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <PartnerDialog
        state={dialogState}
        isSubmitting={isSubmitting}
        onClose={() => setDialogState(null)}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa đối tác?"
        description={`Bạn có chắc muốn xóa đối tác "${deleteTarget?.label || ''}"?`}
        confirmText="Xóa đối tác"
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
