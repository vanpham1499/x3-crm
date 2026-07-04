'use client';

import Link from 'next/link';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Button, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import {
  getPermissionModuleLabel,
  getRoleInitial,
  groupPermissionsByModule,
} from '@/lib/access-control-utils';
import { formatDate } from '@/lib/utils';
import type { Permission, Role } from '@/types/access-control';

export type RoleFormValues = {
  name: string;
  description: string;
  permissionIds: string[];
};

type RoleFormProps = {
  mode: 'create' | 'edit';
  defaultValues: RoleFormValues;
  permissions: Permission[];
  role?: Role;
  isSubmitting: boolean;
  isDeleting?: boolean;
  onSubmit: (values: RoleFormValues) => void;
  onDelete?: () => void;
};

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
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<RoleFormValues>({ defaultValues });

  const displayName = watch('name') || defaultValues.name || 'Vai trò mới';
  const pageTitle = mode === 'create' ? 'Thêm vai trò' : 'Chỉnh sửa vai trò';
  const selectedPermissionIds = watch('permissionIds');
  const permissionGroups = groupPermissionsByModule(permissions);

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">{pageTitle}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Tài khoản</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Vai trò</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">{mode === 'create' ? 'Thêm mới' : displayName}</span>
        </div>
      </div>

      <form
        className="grid w-full items-start gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
        onSubmit={handleSubmit(onSubmit)}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
              {getRoleInitial(displayName)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-950">{displayName}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {selectedPermissionIds.length} quyền đang được chọn
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <TextField
              fullWidth
              label="Tên vai trò *"
              placeholder="VD: SALES_LEADER"
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
              {...register('name', { required: 'Bắt buộc' })}
            />

            <TextField
              fullWidth
              multiline
              minRows={5}
              label="Mô tả"
              placeholder="Mô tả phạm vi quyền hạn của vai trò..."
              {...register('description')}
            />
          </div>

          <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            {role?.createdAt && (
              <p>
                Ngày tạo: <span className="font-bold text-slate-950">{formatDate(role.createdAt)}</span>
              </p>
            )}
            {role?.updatedAt && (
              <p className="mt-2">
                Cập nhật: <span className="font-bold text-slate-950">{formatDate(role.updatedAt)}</span>
              </p>
            )}
            {!role && <p>Vai trò mới sẽ được tạo trước, sau đó đồng bộ danh sách quyền đã chọn.</p>}
          </div>

          {mode === 'edit' && onDelete && (
            <div className="mt-8 flex justify-center">
              <Button
                color="error"
                variant="contained"
                startIcon={<DeleteRoundedIcon />}
                disabled={isDeleting}
                onClick={onDelete}
                className="!bg-red-100 !text-red-700 hover:!bg-red-200"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa vai trò'}
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-950">Phân quyền</h2>
            <p className="mt-1 text-sm text-slate-500">
              Chọn các quyền mà vai trò này được phép sử dụng trong hệ thống.
            </p>
          </div>

          <Controller
            name="permissionIds"
            control={control}
            render={({ field }) => (
              <div className="space-y-4">
                {Object.entries(permissionGroups).map(([module, modulePermissions]) => {
                  const modulePermissionIds = modulePermissions.map((permission) => permission.id);
                  const selectedInModule = modulePermissionIds.filter((id) => field.value.includes(id));
                  const checked = selectedInModule.length === modulePermissionIds.length;
                  const indeterminate = selectedInModule.length > 0 && !checked;

                  const toggleModule = (nextChecked: boolean) => {
                    if (nextChecked) {
                      field.onChange(Array.from(new Set([...field.value, ...modulePermissionIds])));
                      return;
                    }

                    field.onChange(field.value.filter((id) => !modulePermissionIds.includes(id)));
                  };

                  return (
                    <div key={module} className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <FormControlLabel
                          control={
                            <Checkbox
                              color="success"
                              checked={checked}
                              indeterminate={indeterminate}
                              onChange={(event) => toggleModule(event.target.checked)}
                            />
                          }
                          label={
                            <span className="font-bold text-slate-950">
                              {getPermissionModuleLabel(module)}
                            </span>
                          }
                        />
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                          {selectedInModule.length}/{modulePermissionIds.length}
                        </span>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        {modulePermissions.map((permission) => (
                          <FormControlLabel
                            key={permission.id}
                            className="m-0 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50"
                            control={
                              <Checkbox
                                color="success"
                                checked={field.value.includes(permission.id)}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    field.onChange([...field.value, permission.id]);
                                    return;
                                  }

                                  field.onChange(field.value.filter((id) => id !== permission.id));
                                }}
                              />
                            }
                            label={
                              <span className="block min-w-0">
                                <span className="block truncate text-sm font-bold text-slate-800">
                                  {permission.name}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                  {permission.code}
                                </span>
                              </span>
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {permissions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    Chưa có dữ liệu quyền
                  </div>
                )}
              </div>
            )}
          />

          <div className="mt-8 flex justify-end gap-3">
            <Button component={Link} href="/users/roles" variant="outlined">
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || (mode === 'edit' && !isDirty)}
              startIcon={<SaveRoundedIcon />}
              className="!bg-slate-900 !text-white hover:!bg-slate-800 disabled:!cursor-not-allowed disabled:!bg-slate-500 disabled:!text-white disabled:!opacity-50"
            >
              {isSubmitting
                ? mode === 'create'
                  ? 'Đang tạo...'
                  : 'Đang lưu...'
                : mode === 'create'
                  ? 'Tạo vai trò'
                  : 'Lưu thay đổi'}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
