<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const MODULES = [
        'lead' => 'lead',
        'customer' => 'khách hàng',
        'project' => 'dự án',
        'quotation' => 'báo phí',
    ];

    private const LEADER_OLD_GLOBAL_CODES = [
        'lead.update_all',
        'lead.delete_all',
        'customer.update_all',
        'customer.delete_all',
        'quotation.update_all',
        'quotation.delete_all',
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            foreach ($this->permissions() as $permission) {
                DB::table('permissions')->updateOrInsert(
                    ['code' => $permission['code']],
                    [
                        'module' => $permission['module'],
                        'name' => $permission['name'],
                        'description' => 'Quyền '.$permission['name'],
                        'deleted_at' => null,
                        'deleted_by' => null,
                        'updated_at' => $now,
                        'created_at' => $now,
                    ],
                );
            }

            $adminRoleIds = DB::table('roles')
                ->where('name', 'ADMIN')
                ->whereNull('deleted_at')
                ->pluck('id');
            $this->grant($adminRoleIds, array_column($this->permissions(), 'code'), $now);

            foreach (array_keys(self::MODULES) as $module) {
                $this->grantViewAllFromExistingGlobalScope($module, $now);
            }

            $leaderRoleIds = DB::table('roles')
                ->where('name', 'LEADER')
                ->whereNull('deleted_at')
                ->pluck('id');

            $this->revoke($leaderRoleIds, array_merge(
                self::LEADER_OLD_GLOBAL_CODES,
                array_map(fn (string $module): string => $module.'.view_all', array_keys(self::MODULES)),
            ));
            $this->grant($leaderRoleIds, array_merge($this->baseScopeCodes(), $this->departmentCodes()), $now);
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $leaderRoleIds = DB::table('roles')
                ->where('name', 'LEADER')
                ->whereNull('deleted_at')
                ->pluck('id');
            $this->grant($leaderRoleIds, self::LEADER_OLD_GLOBAL_CODES, now());

            $codes = array_column($this->permissions(), 'code');
            $permissionIds = DB::table('permissions')->whereIn('code', $codes)->pluck('id');

            DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
            DB::table('permissions')->whereIn('id', $permissionIds)->delete();
        });
    }

    private function permissions(): array
    {
        $permissions = [];

        foreach (self::MODULES as $module => $label) {
            $permissions[] = ['module' => $module, 'code' => $module.'.view_department', 'name' => 'Xem '.$label.' trong phòng ban'];
            $permissions[] = ['module' => $module, 'code' => $module.'.view_all', 'name' => 'Xem mọi '.$label];
            $permissions[] = ['module' => $module, 'code' => $module.'.update_department', 'name' => 'Cập nhật '.$label.' trong phòng ban'];
            $permissions[] = ['module' => $module, 'code' => $module.'.delete_department', 'name' => 'Xóa '.$label.' trong phòng ban'];
        }

        return $permissions;
    }

    private function departmentCodes(): array
    {
        return collect(array_keys(self::MODULES))
            ->flatMap(fn (string $module): array => [
                $module.'.view_department',
                $module.'.update_department',
                $module.'.delete_department',
            ])
            ->all();
    }

    private function baseScopeCodes(): array
    {
        return collect(array_keys(self::MODULES))
            ->flatMap(fn (string $module): array => [
                $module.'.view',
                $module.'.update',
                $module.'.delete',
            ])
            ->all();
    }

    private function grantViewAllFromExistingGlobalScope(string $module, $now): void
    {
        $sourcePermissionIds = DB::table('permissions')
            ->whereIn('code', [$module.'.update_all', $module.'.delete_all'])
            ->pluck('id');

        if ($sourcePermissionIds->isEmpty()) {
            return;
        }

        $roleIds = DB::table('role_permissions')
            ->whereIn('permission_id', $sourcePermissionIds)
            ->whereNull('deleted_at')
            ->pluck('role_id')
            ->unique();

        $this->grant($roleIds, [$module.'.view_all'], $now);
    }

    private function grant($roleIds, array $codes, $now): void
    {
        if ($roleIds->isEmpty() || $codes === []) {
            return;
        }

        $permissionIds = DB::table('permissions')->whereIn('code', $codes)->pluck('id');
        $rows = $roleIds
            ->crossJoin($permissionIds)
            ->map(fn (array $pair): array => [
                'role_id' => $pair[0],
                'permission_id' => $pair[1],
                'deleted_at' => null,
                'deleted_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->all();

        if ($rows !== []) {
            DB::table('role_permissions')->upsert(
                $rows,
                ['role_id', 'permission_id'],
                ['deleted_at', 'deleted_by', 'updated_at'],
            );
        }
    }

    private function revoke($roleIds, array $codes): void
    {
        if ($roleIds->isEmpty() || $codes === []) {
            return;
        }

        $permissionIds = DB::table('permissions')->whereIn('code', $codes)->pluck('id');

        DB::table('role_permissions')
            ->whereIn('role_id', $roleIds)
            ->whereIn('permission_id', $permissionIds)
            ->delete();
    }
};
