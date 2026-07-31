'use client';

import { useMemo, useState } from 'react';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Button,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { FormActionBar } from '@/components/form/form-action-bar';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { PageHeader } from '@/components/shell/page-header';
import {
  comparePermissionModules,
  getPagePermissionCode,
  getPermissionModuleLabel,
  groupPermissionsByModule,
} from '@/lib/access-control-utils';
import { applyApiErrorsToForm } from '@/lib/api-error';
import { formatDate } from '@/lib/utils';
import type { Permission, Role } from '@/types/access-control';

export type RoleFormValues = {
  name: string;
  description: string;
  permissionIds: number[];
};

type RoleFormProps = {
  mode: 'create' | 'edit';
  defaultValues: RoleFormValues;
  permissions: Permission[];
  role?: Role;
  isSubmitting: boolean;
  isDeleting?: boolean;
  onSubmit: (values: RoleFormValues) => Promise<unknown>;
  onDelete?: () => void;
};

function uniqueIds(ids: number[]) {
  return Array.from(new Set(ids));
}

function normalizePermissionName(name: string) {
  return name
    .replace(/ của mình/gi, '')
    .replace(/ thuộc phạm vi/gi, '')
    .replace(/ \(dự án mình quản lý\)/gi, '')
    .trim();
}

function matchesPermissionSearch(permission: Permission, keyword: string) {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');
  if (!normalizedKeyword) return true;

  return [permission.name, permission.code, permission.description]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase('vi').includes(normalizedKeyword));
}

export function getRoleFormDefaults(role?: Role): RoleFormValues {
  return {
    name: role?.name || '',
    description: role?.description || '',
    permissionIds: role?.permissions?.map((permission) => permission.id) || [],
  };
}

export function RoleForm({
  mode,
  defaultValues,
  permissions,
  role,
  isSubmitting,
  isDeleting = false,
  onSubmit,
  onDelete,
}: RoleFormProps) {
  const [permissionKeyword, setPermissionKeyword] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<RoleFormValues>({ defaultValues });

  const displayName = watch('name') || defaultValues.name || 'Vai trò mới';
  const selectedPermissionIds = watch('permissionIds');
  const permissionGroups = useMemo(() => groupPermissionsByModule(permissions), [permissions]);
  const orderedPermissionGroups = useMemo(
    () =>
      Object.entries(permissionGroups).sort(([left], [right]) =>
        comparePermissionModules(left, right),
      ),
    [permissionGroups],
  );
  const visibleModules = useMemo(
    () =>
      orderedPermissionGroups.filter(([module, modulePermissions]) => {
        const normalizedKeyword = permissionKeyword.trim().toLocaleLowerCase('vi');
        if (!normalizedKeyword) return true;

        return (
          getPermissionModuleLabel(module).toLocaleLowerCase('vi').includes(normalizedKeyword) ||
          modulePermissions.some((permission) =>
            matchesPermissionSearch(permission, permissionKeyword),
          )
        );
      }),
    [orderedPermissionGroups, permissionKeyword],
  );
  const selectedPageCount = orderedPermissionGroups.filter(([module, modulePermissions]) => {
    const pageCode = getPagePermissionCode(module);
    const pagePermission = modulePermissions.find((permission) => permission.code === pageCode);
    return pagePermission ? selectedPermissionIds.includes(pagePermission.id) : false;
  }).length;
  const totalPageCount = orderedPermissionGroups.filter(([module]) =>
    Boolean(getPagePermissionCode(module)),
  ).length;

  const submitForm = handleSubmit(async (values) => {
    try {
      await onSubmit({ ...values, permissionIds: uniqueIds(values.permissionIds) });
    } catch (error) {
      applyApiErrorsToForm(error, setError);
    }
  });

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
      <PageHeader
        title={mode === 'create' ? 'Thêm vai trò' : displayName}
        currentLabel={mode === 'edit' ? 'Chỉnh sửa' : undefined}
      />

      <form noValidate className="flex w-full flex-1 flex-col" onSubmit={submitForm}>
        <div className="grid w-full items-start gap-6 xl:grid-cols-12">
          <div className="xl:col-span-12">
            <FormSection title="Thông tin vai trò">
              <div className="grid items-start gap-4 md:grid-cols-12">
                <FormInputField
                  className="md:col-span-4"
                  label="Tên vai trò *"
                  placeholder="VD: SALES_LEADER"
                  error={Boolean(errors.name)}
                  helperText={errors.name?.message}
                  {...register('name', { required: 'Vui lòng nhập tên vai trò' })}
                />
                <FormInputField
                  className="md:col-span-8"
                  multiline
                  minRows={3}
                  label="Mô tả"
                  {...register('description')}
                />

                <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 md:col-span-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    Quyền đang cấp
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold text-slate-800 ring-1 ring-slate-200">
                      {selectedPageCount} trang
                    </span>
                    <span className="rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold text-slate-800 ring-1 ring-slate-200">
                      {selectedPermissionIds.length} quyền
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    Chọn phạm vi xem trang và các chức năng ngay trong từng nhóm bên dưới.
                  </p>
                </div>

                {mode === 'edit' ? (
                  <div className="grid gap-4 md:col-span-6 md:grid-cols-2">
                    <FormInputField
                      label="Ngày tạo"
                      value={formatDate(role?.createdAt || '')}
                      disabled
                    />
                    <FormInputField
                      label="Cập nhật"
                      value={formatDate(role?.updatedAt || '')}
                      disabled
                    />
                  </div>
                ) : null}

                {mode === 'edit' && onDelete ? (
                  <div className="flex items-start justify-end md:col-span-2">
                    <Button
                      color="error"
                      size="small"
                      variant="outlined"
                      startIcon={<DeleteRoundedIcon />}
                      disabled={isDeleting}
                      onClick={onDelete}
                      className="!h-9 !rounded-lg !text-[13px] !font-bold"
                    >
                      {isDeleting ? 'Đang xóa...' : 'Xóa vai trò'}
                    </Button>
                  </div>
                ) : null}
              </div>
            </FormSection>
          </div>

          <div className="xl:col-span-12">
            <FormSection
              title="Phân quyền theo trang"
              action={
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  {selectedPageCount}/{totalPageCount} trang
                </span>
              }
            >
              <TextField
                fullWidth
                size="small"
                label="Tìm trang hoặc chức năng"
                placeholder="VD: Thanh toán, chỉnh sửa, duyệt..."
                value={permissionKeyword}
                onChange={(event) => setPermissionKeyword(event.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon className="text-slate-400" fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Controller
                name="permissionIds"
                control={control}
                render={({ field }) => (
                  <div className="!mt-4 grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-4">
                    {visibleModules.map(([module, modulePermissions]) => {
                      const moduleLabel = getPermissionModuleLabel(module);
                      const pageCode = getPagePermissionCode(module);
                      const pagePermission = modulePermissions.find(
                        (permission) => permission.code === pageCode,
                      );
                      const pageDepartmentPermission = pagePermission
                        ? modulePermissions.find(
                            (permission) => permission.code === `${pagePermission.code}_department`,
                          )
                        : undefined;
                      const pageAllPermission = pagePermission
                        ? modulePermissions.find(
                            (permission) => permission.code === `${pagePermission.code}_all`,
                          )
                        : undefined;
                      const pageSelected = Boolean(
                        pagePermission &&
                        (field.value.includes(pagePermission.id) ||
                          (pageDepartmentPermission &&
                            field.value.includes(pageDepartmentPermission.id)) ||
                          (pageAllPermission && field.value.includes(pageAllPermission.id))),
                      );
                      const moduleMatchesSearch = moduleLabel
                        .toLocaleLowerCase('vi')
                        .includes(permissionKeyword.trim().toLocaleLowerCase('vi'));
                      const baseActions = modulePermissions.filter(
                        (permission) =>
                          permission.id !== pagePermission?.id &&
                          !permission.code.endsWith('_department') &&
                          !permission.code.endsWith('_all') &&
                          (moduleMatchesSearch ||
                            matchesPermissionSearch(permission, permissionKeyword)),
                      );
                      const selectedInModule = modulePermissions.filter((permission) =>
                        field.value.includes(permission.id),
                      ).length;
                      const addPagePermission = (
                        ids: number[],
                        scope?: 'own' | 'department' | 'all',
                      ) => {
                        if (!pagePermission) return uniqueIds(ids);

                        const nextIds = [...ids, pagePermission.id];

                        if (scope === 'department' && pageDepartmentPermission) {
                          nextIds.push(pageDepartmentPermission.id);
                        }

                        if (scope === 'all' && pageAllPermission) {
                          nextIds.push(pageAllPermission.id);
                        }

                        return uniqueIds(nextIds);
                      };

                      return (
                        <div
                          key={module}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm"
                        >
                          <div className="flex min-h-16 items-center border-b border-slate-100 bg-white px-4">
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-950">
                                  {moduleLabel}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {pagePermission
                                    ? pageSelected
                                      ? 'Được xem trang'
                                      : 'Đang ẩn trang'
                                    : 'Quyền hỗ trợ dùng chung'}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
                                  pageSelected
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : selectedInModule > 0
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {selectedInModule}/{modulePermissions.length}
                              </span>
                            </div>
                          </div>

                          <div id={`permission-panel-${module}`} className="p-4">
                            {pagePermission ? (
                              <div className="mb-3 flex flex-col gap-2 rounded-xl border border-primary/15 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                <FormControlLabel
                                  className="!m-0 !min-w-0 !flex-1"
                                  control={
                                    <Checkbox
                                      size="small"
                                      color="success"
                                      checked={pageSelected}
                                      onChange={(event) => {
                                        if (event.target.checked) {
                                          field.onChange(
                                            uniqueIds([...field.value, pagePermission.id]),
                                          );
                                          return;
                                        }

                                        const moduleIds = modulePermissions.map(
                                          (permission) => permission.id,
                                        );
                                        field.onChange(
                                          field.value.filter((id) => !moduleIds.includes(id)),
                                        );
                                      }}
                                    />
                                  }
                                  label={
                                    <span className="block min-w-0 py-1">
                                      <span className="block text-sm font-bold text-slate-900">
                                        Xem trang {moduleLabel}
                                      </span>
                                    </span>
                                  }
                                />

                                {(pageDepartmentPermission || pageAllPermission) && pageSelected ? (
                                  <TextField
                                    select
                                    size="small"
                                    label="Phạm vi xem"
                                    value={
                                      pageAllPermission &&
                                      field.value.includes(pageAllPermission.id)
                                        ? 'all'
                                        : pageDepartmentPermission &&
                                            field.value.includes(pageDepartmentPermission.id)
                                          ? 'department'
                                          : 'own'
                                    }
                                    className="w-full sm:!w-36"
                                    onChange={(event) => {
                                      const scopeIds = [
                                        pagePermission.id,
                                        pageDepartmentPermission?.id,
                                        pageAllPermission?.id,
                                      ].filter((id): id is number => Boolean(id));
                                      const withoutScope = field.value.filter(
                                        (id) => !scopeIds.includes(id),
                                      );
                                      const nextIds = [...withoutScope, pagePermission.id];

                                      if (
                                        event.target.value === 'department' &&
                                        pageDepartmentPermission
                                      ) {
                                        nextIds.push(pageDepartmentPermission.id);
                                      }

                                      if (event.target.value === 'all' && pageAllPermission) {
                                        nextIds.push(pageAllPermission.id);
                                      }

                                      field.onChange(uniqueIds(nextIds));
                                    }}
                                  >
                                    <MenuItem value="own">Của mình</MenuItem>
                                    {pageDepartmentPermission ? (
                                      <MenuItem value="department">Phòng ban</MenuItem>
                                    ) : null}
                                    {pageAllPermission ? (
                                      <MenuItem value="all">Toàn bộ</MenuItem>
                                    ) : null}
                                  </TextField>
                                ) : null}
                              </div>
                            ) : null}

                            <div className="grid gap-2">
                              {baseActions.map((permission) => {
                                const departmentPermission = modulePermissions.find(
                                  (candidate) => candidate.code === `${permission.code}_department`,
                                );
                                const allPermission = modulePermissions.find(
                                  (candidate) => candidate.code === `${permission.code}_all`,
                                );
                                const selected = field.value.includes(permission.id);
                                const selectedDepartment = departmentPermission
                                  ? field.value.includes(departmentPermission.id)
                                  : false;
                                const selectedAll = allPermission
                                  ? field.value.includes(allPermission.id)
                                  : false;

                                return (
                                  <div
                                    key={permission.id}
                                    className="flex min-h-14 flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <FormControlLabel
                                      className="!m-0 !min-w-0 !flex-1"
                                      control={
                                        <Checkbox
                                          size="small"
                                          color="success"
                                          checked={selected || selectedDepartment || selectedAll}
                                          onChange={(event) => {
                                            const pairedIds = [
                                              permission.id,
                                              departmentPermission?.id,
                                              allPermission?.id,
                                            ].filter((id): id is number => Boolean(id));

                                            if (event.target.checked) {
                                              field.onChange(
                                                addPagePermission([...field.value, permission.id]),
                                              );
                                              return;
                                            }

                                            field.onChange(
                                              field.value.filter((id) => !pairedIds.includes(id)),
                                            );
                                          }}
                                        />
                                      }
                                      label={
                                        <span className="block min-w-0 py-1">
                                          <span className="block text-sm font-semibold text-slate-800">
                                            {normalizePermissionName(permission.name)}
                                          </span>
                                          <span className="block font-mono text-[11px] text-slate-500">
                                            {permission.code}
                                          </span>
                                        </span>
                                      }
                                    />

                                    {(departmentPermission || allPermission) &&
                                    (selected || selectedDepartment || selectedAll) ? (
                                      <TextField
                                        select
                                        size="small"
                                        label="Phạm vi"
                                        value={
                                          selectedAll
                                            ? 'all'
                                            : selectedDepartment
                                              ? 'department'
                                              : 'own'
                                        }
                                        className="w-full sm:!w-36"
                                        onChange={(event) => {
                                          const withoutPair = field.value.filter(
                                            (id) =>
                                              id !== permission.id &&
                                              id !== departmentPermission?.id &&
                                              id !== allPermission?.id,
                                          );
                                          const nextIds = [...withoutPair, permission.id];

                                          if (
                                            event.target.value === 'department' &&
                                            departmentPermission
                                          ) {
                                            nextIds.push(departmentPermission.id);
                                          }

                                          if (event.target.value === 'all' && allPermission) {
                                            nextIds.push(allPermission.id);
                                          }

                                          field.onChange(
                                            addPagePermission(
                                              nextIds,
                                              event.target.value as 'own' | 'department' | 'all',
                                            ),
                                          );
                                        }}
                                      >
                                        <MenuItem value="own">Của mình</MenuItem>
                                        {departmentPermission ? (
                                          <MenuItem value="department">Phòng ban</MenuItem>
                                        ) : null}
                                        {allPermission ? (
                                          <MenuItem value="all">Toàn bộ</MenuItem>
                                        ) : null}
                                      </TextField>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>

                            {baseActions.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-500">
                                Trang này hiện chưa có chức năng con được tách quyền.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}

                    {visibleModules.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-semibold text-slate-500 lg:col-span-2 2xl:col-span-3">
                        Không tìm thấy trang hoặc chức năng phù hợp
                      </div>
                    ) : null}
                  </div>
                )}
              />
            </FormSection>
          </div>
        </div>

        <FormActionBar
          cancelHref="/users/roles"
          submitLabel={mode === 'create' ? 'Tạo vai trò' : 'Lưu thay đổi'}
          submittingLabel={mode === 'create' ? 'Đang tạo...' : 'Đang lưu...'}
          isSubmitting={isSubmitting}
          submitDisabled={mode === 'edit' && !isDirty}
          submitIcon={<SaveRoundedIcon />}
        />
      </form>
    </div>
  );
}
