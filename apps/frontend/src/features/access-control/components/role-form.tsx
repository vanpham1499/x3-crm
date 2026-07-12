'use client';

import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Button, Checkbox, FormControlLabel } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { FormActionBar } from '@/components/form/form-action-bar';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { PageHeader } from '@/components/shell/page-header';
import { getPermissionModuleLabel, groupPermissionsByModule } from '@/lib/access-control-utils';
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
  const selectedPermissionIds = watch('permissionIds');
  const permissionGroups = groupPermissionsByModule(permissions);

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
      <PageHeader
        title={mode === 'create' ? 'Thêm vai trò' : displayName}
        currentLabel={mode === 'edit' ? 'Chỉnh sửa' : undefined}
      />

      <form className="flex w-full flex-1 flex-col" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid w-full items-start gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <FormSection title="Thông tin vai trò">
              <FormInputField
                label="Tên vai trò *"
                placeholder="VD: SALES_LEADER"
                error={Boolean(errors.name)}
                helperText={errors.name?.message}
                {...register('name', { required: 'Vui lòng nhập tên vai trò' })}
              />
              <FormInputField multiline minRows={5} label="Mô tả" {...register('description')} />

              {mode === 'edit' ? (
                <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
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
                <div className="border-t border-slate-100 pt-4">
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
            </FormSection>
          </div>

          <div className="xl:col-span-8">
            <FormSection
              title="Phân quyền"
              action={
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  {selectedPermissionIds.length} đã chọn
                </span>
              }
            >
              <Controller
                name="permissionIds"
                control={control}
                render={({ field }) => (
                  <div className="!mt-0 space-y-4">
                    {Object.entries(permissionGroups).map(([module, modulePermissions]) => {
                      const modulePermissionIds = modulePermissions.map(
                        (permission) => permission.id,
                      );
                      const selectedInModule = modulePermissionIds.filter((id) =>
                        field.value.includes(id),
                      );
                      const checked =
                        modulePermissionIds.length > 0 &&
                        selectedInModule.length === modulePermissionIds.length;
                      const indeterminate = selectedInModule.length > 0 && !checked;

                      const toggleModule = (nextChecked: boolean) => {
                        if (nextChecked) {
                          field.onChange(
                            Array.from(new Set([...field.value, ...modulePermissionIds])),
                          );
                          return;
                        }

                        field.onChange(
                          field.value.filter((id) => !modulePermissionIds.includes(id)),
                        );
                      };

                      return (
                        <div key={module} className="rounded-xl border border-slate-200 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <FormControlLabel
                              className="!m-0"
                              control={
                                <Checkbox
                                  size="small"
                                  color="success"
                                  checked={checked}
                                  indeterminate={indeterminate}
                                  onChange={(event) => toggleModule(event.target.checked)}
                                />
                              }
                              label={
                                <span className="text-sm font-bold text-slate-950">
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
                                className="!m-0 !min-h-12 rounded-lg border border-slate-100 px-2 py-1.5 hover:bg-slate-50"
                                control={
                                  <Checkbox
                                    size="small"
                                    color="success"
                                    checked={field.value.includes(permission.id)}
                                    onChange={(event) => {
                                      if (event.target.checked) {
                                        field.onChange([...field.value, permission.id]);
                                        return;
                                      }

                                      field.onChange(
                                        field.value.filter((id) => id !== permission.id),
                                      );
                                    }}
                                  />
                                }
                                label={
                                  <span className="block min-w-0">
                                    <span className="block truncate text-sm font-semibold text-slate-800">
                                      {permission.name}
                                    </span>
                                    <span className="block truncate font-mono text-xs text-slate-500">
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

                    {permissions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                        Chưa có dữ liệu quyền
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
