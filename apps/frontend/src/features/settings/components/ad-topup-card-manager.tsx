'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { FormInputField } from '@/components/form/form-input-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import {
  getAdTopupCardDefaults,
  getAdTopupCardMetaValue,
  type AdTopupCardFormValues,
} from '@/lib/ad-topup-card-options';
import { applyApiErrorsToForm, getApiFieldErrors } from '@/lib/api-error';
import { canManageCatalog } from '@/lib/ownership';
import { useAuthStore } from '@/stores/auth-store';
import type { AppOption } from '@/types/option';

type DialogState = { mode: 'create' } | { mode: 'edit'; card: AppOption };

type AdTopupCardManagerProps = {
  cards: AppOption[];
  keyword: string;
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onKeywordChange: (keyword: string) => void;
  onSubmit: (values: AdTopupCardFormValues, card?: AppOption | null) => Promise<unknown>;
  onDelete: (card: AppOption) => void;
};

function AdTopupCardDialog({
  state,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: DialogState | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: AdTopupCardFormValues, card?: AppOption | null) => Promise<unknown>;
}) {
  const card = state?.mode === 'edit' ? state.card : null;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AdTopupCardFormValues>({ values: getAdTopupCardDefaults(card) });

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <AppFormDialog
      open={Boolean(state)}
      title={state?.mode === 'edit' ? 'Chỉnh sửa thẻ nạp QC' : 'Thêm thẻ nạp QC'}
      maxWidth="sm"
      submitting={isSubmitting}
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values, card);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
          const fieldErrors = getApiFieldErrors(error);
          if (fieldErrors.key) setError('code', { type: 'server', message: fieldErrors.key });
          if (fieldErrors.label) setError('name', { type: 'server', message: fieldErrors.label });
          if (fieldErrors.value) {
            setError('cardInfo', { type: 'server', message: fieldErrors.value });
          }
        }
      })}
      contentClassName="grid gap-3 sm:grid-cols-2"
      actions={
        <>
          <DialogActionButton onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu thẻ nạp'}
          </DialogActionButton>
        </>
      }
    >
      <FormInputField
        label="Mã thẻ *"
        error={Boolean(errors.code)}
        helperText={errors.code?.message}
        {...register('code', { required: 'Bắt buộc' })}
      />
      <FormInputField
        label="Tên thẻ *"
        error={Boolean(errors.name)}
        helperText={errors.name?.message}
        {...register('name', { required: 'Bắt buộc' })}
      />
      <FormInputField
        label="Thông tin thẻ"
        className="sm:col-span-2"
        placeholder="Ví dụ: Visa **** 1234"
        error={Boolean(errors.cardInfo)}
        helperText={errors.cardInfo?.message}
        {...register('cardInfo')}
      />
      <FormInputField
        label="Ghi chú"
        multiline
        minRows={2}
        className="sm:col-span-2"
        {...register('note')}
      />
    </AppFormDialog>
  );
}

export function AdTopupCardManager({
  cards,
  keyword,
  isFetching,
  isSubmitting,
  isDeleting,
  onKeywordChange,
  onSubmit,
  onDelete,
}: AdTopupCardManagerProps) {
  const currentUser = useAuthStore((state) => state.user);
  const canManage = canManageCatalog(currentUser);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppOption | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeCard, setActiveCard] = useState<AppOption | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(cards, {
    resetKey: keyword,
  });

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, card: AppOption) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveCard(card);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveCard(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Thẻ nạp quảng cáo"
        action={{
          label: 'Thêm thẻ nạp',
          icon: <AddRoundedIcon />,
          onClick: () => setDialogState({ mode: 'create' }),
          disabled: !canManage,
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm mã thẻ, tên thẻ hoặc thông tin thẻ..."
            value={keyword}
            onChange={onKeywordChange}
          />
        </div>

        <AppDataTable
          columns={[
            { key: 'code', label: 'Mã thẻ', className: 'w-44' },
            { key: 'name', label: 'Tên thẻ', className: 'w-72' },
            { key: 'cardInfo', label: 'Thông tin thẻ', className: 'w-72' },
            { key: 'note', label: 'Ghi chú' },
            { key: 'actions', className: 'w-28' },
          ]}
          isLoading={isFetching}
          isEmpty={pageItems.length === 0}
          emptyText="Chưa có thẻ nạp quảng cáo"
          minWidthClassName="min-w-[900px]"
        >
          {pageItems.map((card) => (
            <tr key={card.id} className="group hover:bg-slate-50/80">
              <td className="px-3 py-4">
                <span className="inline-flex items-center gap-2 font-bold text-primary">
                  <CreditCardRoundedIcon className="!text-[18px]" />
                  {card.key || '-'}
                </span>
              </td>
              <td className="px-3 py-4 font-semibold text-slate-900">
                <span className="block truncate" title={card.label || ''}>
                  {card.label || '-'}
                </span>
              </td>
              <td className="px-3 py-4 text-slate-700">
                <span
                  className="block truncate"
                  title={card.value && card.value !== card.key ? card.value : ''}
                >
                  {card.value && card.value !== card.key ? card.value : '-'}
                </span>
              </td>
              <td className="px-3 py-4 text-slate-600">
                <span className="block truncate" title={getAdTopupCardMetaValue(card, 'note')}>
                  {getAdTopupCardMetaValue(card, 'note') || '-'}
                </span>
              </td>
              <td className="py-4">
                <div className="flex items-center justify-end gap-1 pr-3">
                  <IconButton
                    size="small"
                    title="Chỉnh sửa thẻ nạp"
                    aria-label={`Chỉnh sửa thẻ nạp ${card.label}`}
                    onClick={() => setDialogState({ mode: 'edit', card })}
                    disabled={!canManage}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    title="Tác vụ"
                    aria-label={`Tác vụ thẻ nạp ${card.label}`}
                    onClick={(event) => openActionMenu(event, card)}
                  >
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
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
        <MenuItem
          onClick={() => {
            if (activeCard) setDialogState({ mode: 'edit', card: activeCard });
            closeActionMenu();
          }}
          disabled={!canManage}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          className="!text-rose-600"
          disabled={isDeleting || !canManage}
          onClick={() => {
            if (activeCard) setDeleteTarget(activeCard);
            closeActionMenu();
          }}
        >
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <AdTopupCardDialog
        state={dialogState}
        isSubmitting={isSubmitting}
        onClose={() => setDialogState(null)}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa thẻ nạp quảng cáo?"
        description={`Bạn có chắc muốn xóa thẻ "${deleteTarget?.label || ''}"?`}
        confirmText="Xóa thẻ"
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
