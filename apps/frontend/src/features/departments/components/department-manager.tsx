'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import {
  Autocomplete,
  Avatar,
  Checkbox,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { applyApiErrorsToForm } from '@/lib/api-error';
import { canCreateUsers, canDeleteUsers, canEditUsers } from '@/lib/ownership';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { Department, DepartmentFormValues, DepartmentPayload } from '@/types/department';
import type { User } from '@/types/user';

type DialogState = { mode: 'create' } | { mode: 'edit'; department: Department };

type DepartmentManagerProps = {
  departments: Department[];
  users: User[];
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onSubmit: (payload: DepartmentPayload, department?: Department | null) => Promise<unknown>;
  onDelete: (department: Department) => Promise<unknown>;
};

function getUserLabel(user: User) {
  return [user.code, user.name || user.email].filter(Boolean).join(' · ');
}

function getUserInitial(user?: User | null) {
  return (user?.name || user?.email || user?.code || 'X').trim().charAt(0).toUpperCase();
}

function getDepartmentDefaults(department?: Department | null): DepartmentFormValues {
  const leaderUserId = department?.leaderUserId ? String(department.leaderUserId) : '';

  return {
    name: department?.name || '',
    leaderUserId,
    memberUserIds: (department?.members || [])
      .filter((member) => String(member.id) !== leaderUserId)
      .map((member) => String(member.id)),
  };
}

function toDepartmentPayload(values: DepartmentFormValues): DepartmentPayload {
  const leaderUserId = Number(values.leaderUserId);

  return {
    name: values.name.trim(),
    leaderUserId,
    memberUserIds: values.memberUserIds
      .map(Number)
      .filter((userId) => userId > 0 && userId !== leaderUserId),
  };
}

function DepartmentDialog({
  state,
  users,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: DialogState | null;
  users: User[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: DepartmentPayload, department?: Department | null) => Promise<unknown>;
}) {
  const department = state?.mode === 'edit' ? state.department : null;
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepartmentFormValues>({ values: getDepartmentDefaults(department) });
  const leaderUserId = watch('leaderUserId');
  const employeeOptions = useMemo(
    () => users.filter((user) => String(user.id) !== leaderUserId),
    [leaderUserId, users],
  );

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <AppFormDialog
      open={Boolean(state)}
      title={department ? 'Chỉnh sửa phòng ban' : 'Thêm phòng ban'}
      maxWidth="sm"
      submitting={isSubmitting}
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(toDepartmentPayload(values), department);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      contentClassName="grid gap-4"
      actions={
        <>
          <DialogActionButton onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu phòng ban'}
          </DialogActionButton>
        </>
      }
    >
      <FormInputField
        required
        label="Tên phòng ban"
        error={Boolean(errors.name)}
        helperText={errors.name?.message}
        {...register('name', {
          validate: (value) => value.trim() !== '' || 'Vui lòng nhập tên phòng ban',
          maxLength: { value: 100, message: 'Tên phòng ban không được vượt quá 100 ký tự' },
        })}
      />

      <Controller
        name="leaderUserId"
        control={control}
        rules={{ required: 'Vui lòng chọn Lead phòng ban' }}
        render={({ field }) => (
          <Autocomplete
            options={users}
            value={users.find((user) => String(user.id) === field.value) || null}
            getOptionLabel={getUserLabel}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_event, nextUser) => {
              const nextLeaderId = nextUser ? String(nextUser.id) : '';
              field.onChange(nextLeaderId);
              setValue(
                'memberUserIds',
                watch('memberUserIds').filter((userId) => userId !== nextLeaderId),
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                required
                label="Lead phòng ban"
                size="small"
                className={compactFormFieldClassName}
                error={Boolean(errors.leaderUserId)}
                helperText={errors.leaderUserId?.message}
              />
            )}
          />
        )}
      />

      <Controller
        name="memberUserIds"
        control={control}
        render={({ field }) => (
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={employeeOptions}
            value={employeeOptions.filter((user) => field.value.includes(String(user.id)))}
            getOptionLabel={getUserLabel}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_event, selectedUsers) =>
              field.onChange(selectedUsers.map((user) => String(user.id)))
            }
            renderValue={(selectedUsers, getItemProps) => {
              const visibleUser = selectedUsers[0];
              const hiddenCount = Math.max(selectedUsers.length - 1, 0);

              return (
                <>
                  {visibleUser
                    ? (() => {
                        const { key, ...itemProps } = getItemProps({ index: 0 });

                        return (
                          <Chip
                            key={key}
                            {...itemProps}
                            label={getUserLabel(visibleUser)}
                            size="small"
                            title={getUserLabel(visibleUser)}
                            sx={{
                              maxWidth: 220,
                              '& .MuiChip-label': {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              },
                            }}
                          />
                        );
                      })()
                    : null}
                  {hiddenCount > 0 ? (
                    <Chip
                      size="small"
                      label={`+${hiddenCount}`}
                      title={`Đã chọn thêm ${hiddenCount} nhân viên`}
                      sx={{
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        fontWeight: 700,
                      }}
                    />
                  ) : null}
                </>
              );
            }}
            renderOption={(props, option, { selected }) => {
              const { key, ...optionProps } = props;

              return (
                <li key={key} {...optionProps}>
                  <Checkbox checked={selected} size="small" sx={{ mr: 1, p: 0.5 }} />
                  <span className="truncate" title={getUserLabel(option)}>
                    {getUserLabel(option)}
                  </span>
                </li>
              );
            }}
            sx={{
              '& .MuiAutocomplete-inputRoot': {
                flexWrap: 'nowrap',
                overflow: 'hidden',
              },
              '& .MuiAutocomplete-input': {
                minWidth: '96px !important',
              },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Nhân viên"
                placeholder={field.value.length > 0 ? 'Tìm thêm' : 'Tìm và chọn nhân viên'}
                size="small"
                className={compactFormFieldClassName}
                error={Boolean(errors.memberUserIds)}
                helperText={errors.memberUserIds?.message}
              />
            )}
          />
        )}
      />
    </AppFormDialog>
  );
}

export function DepartmentManager({
  departments,
  users,
  isFetching,
  isSubmitting,
  isDeleting,
  onSubmit,
  onDelete,
}: DepartmentManagerProps) {
  const currentUser = useAuthStore((state) => state.user);
  const canCreate = canCreateUsers(currentUser);
  const canEdit = canEditUsers(currentUser);
  const canDelete = canDeleteUsers(currentUser);
  const [keyword, setKeyword] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<Department | null>(null);
  const filteredDepartments = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');
    if (!normalizedKeyword) return departments;

    return departments.filter((department) =>
      [department.name, department.leader?.name, department.leader?.code]
        .concat(department.members.map((member) => member.name || member.code))
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('vi').includes(normalizedKeyword)),
    );
  }, [departments, keyword]);
  const { pageItems, page, setPage, totalPages, totalItems } = usePagination(filteredDepartments, {
    pageSize,
    resetKey: keyword,
  });

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, department: Department) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveDepartment(department);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveDepartment(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Phòng ban"
        action={{
          label: 'Thêm phòng ban',
          icon: <AddRoundedIcon />,
          onClick: () => setDialogState({ mode: 'create' }),
          disabled: !canCreate,
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm phòng ban, Lead hoặc nhân viên..."
            value={keyword}
            onChange={setKeyword}
          />
        </div>

        <AppDataTable
          columns={[
            { key: 'department', label: 'Phòng ban', className: 'w-64' },
            { key: 'leader', label: 'Lead', className: 'w-72' },
            { key: 'employees', label: 'Nhân viên' },
            { key: 'count', label: 'Số lượng', className: 'w-28' },
            { key: 'updated', label: 'Cập nhật', className: 'w-36' },
            { key: 'actions', className: 'w-28' },
          ]}
          isLoading={isFetching}
          isEmpty={pageItems.length === 0}
          emptyText="Chưa có phòng ban"
          minWidthClassName="min-w-[980px]"
        >
          {pageItems.map((department) => {
            const employees = department.members.filter(
              (member) => member.id !== department.leaderUserId,
            );
            const employeeNames = employees.map(getUserLabel).join(', ');

            return (
              <tr key={department.id} className="group hover:bg-slate-50/80">
                <td className="px-3 py-4">
                  <span className="flex items-center gap-2 font-bold text-slate-950">
                    <CorporateFareRoundedIcon className="!text-[19px] text-primary" />
                    <span className="truncate" title={department.name}>
                      {department.name}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-4">
                  {department.leader ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="!h-8 !w-8 !bg-primary/10 !text-xs !font-bold !text-primary">
                        {getUserInitial(department.leader)}
                      </Avatar>
                      <span className="truncate font-semibold text-slate-800">
                        {getUserLabel(department.leader)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-amber-600">Chưa chọn</span>
                  )}
                </td>
                <td className="px-3 py-4 text-slate-700">
                  <span className="block truncate" title={employeeNames}>
                    {employeeNames || 'Chưa có nhân viên'}
                  </span>
                </td>
                <td className="px-3 py-4 font-semibold text-slate-700">{employees.length}</td>
                <td className="px-3 py-4 text-slate-600">
                  {formatDate(department.updatedAt || department.createdAt || '')}
                </td>
                <td className="py-4">
                  <div className="flex items-center justify-end gap-1 pr-3">
                    <IconButton
                      size="small"
                      title="Chỉnh sửa phòng ban"
                      aria-label={`Chỉnh sửa phòng ban ${department.name}`}
                      disabled={!canEdit}
                      onClick={() => setDialogState({ mode: 'edit', department })}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Tác vụ"
                      aria-label={`Tác vụ phòng ban ${department.name}`}
                      onClick={(event) => openActionMenu(event, department)}
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
          onPageSizeChange={setPageSize}
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          disabled={!canEdit}
          onClick={() => {
            if (activeDepartment) {
              setDialogState({ mode: 'edit', department: activeDepartment });
            }
            closeActionMenu();
          }}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          className="!text-rose-600"
          disabled={!canDelete || isDeleting}
          onClick={() => {
            if (activeDepartment) setDeleteTarget(activeDepartment);
            closeActionMenu();
          }}
        >
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <DepartmentDialog
        state={dialogState}
        users={users}
        isSubmitting={isSubmitting}
        onClose={() => setDialogState(null)}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa phòng ban?"
        description={`Bạn có chắc muốn xóa phòng ban "${deleteTarget?.name || ''}"? Nhân viên sẽ được đưa ra khỏi phòng ban này.`}
        confirmText="Xóa phòng ban"
        loading={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
