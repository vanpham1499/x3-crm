<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        'kpi.manage_department' => 'Lập KPI trong phòng ban',
        'kpi.manage_all' => 'Lập toàn bộ KPI',
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            DB::table('permissions')
                ->where('code', 'kpi.manage')
                ->update([
                    'name' => 'Lập KPI của mình',
                    'description' => 'Lập kế hoạch KPI cho chính mình',
                    'updated_at' => $now,
                ]);

            foreach (self::PERMISSIONS as $code => $name) {
                DB::table('permissions')->updateOrInsert(
                    ['code' => $code],
                    [
                        'module' => 'kpi',
                        'name' => $name,
                        'description' => 'Quyền '.$name,
                        'deleted_at' => null,
                        'deleted_by' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                );
            }

            $leaderRoleIds = $this->roleIds(['LEADER']);
            $adminRoleIds = $this->roleIds(['ADMIN']);
            $existingManagerRoleIds = $this->roleIdsWithPermission('kpi.manage');
            $globalManagerRoleIds = $existingManagerRoleIds
                ->diff($leaderRoleIds)
                ->values();

            $this->grant($globalManagerRoleIds, ['kpi.manage_all'], $now);
            $this->grant($adminRoleIds, [
                'kpi.manage',
                'kpi.manage_department',
                'kpi.manage_all',
                'kpi.view_all',
            ], $now);
            $this->grant($leaderRoleIds, [
                'kpi.manage',
                'kpi.manage_department',
                'kpi.view_department',
            ], $now);
            $this->revoke($leaderRoleIds, ['kpi.manage_all', 'kpi.view_all']);
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $permissionIds = DB::table('permissions')
                ->whereIn('code', array_keys(self::PERMISSIONS))
                ->pluck('id');

            DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
            DB::table('permissions')->whereIn('id', $permissionIds)->delete();
            DB::table('permissions')
                ->where('code', 'kpi.manage')
                ->update([
                    'name' => 'Quản lý kế hoạch KPI',
                    'description' => 'Quyền Quản lý kế hoạch KPI',
                    'updated_at' => now(),
                ]);

            $managerRoleIds = $this->roleIdsWithPermission('kpi.manage');
            $this->grant($managerRoleIds, ['kpi.view_all'], now());
        });
    }

    private function roleIds(array $names)
    {
        return DB::table('roles')
            ->whereIn('name', $names)
            ->whereNull('deleted_at')
            ->pluck('id');
    }

    private function roleIdsWithPermission(string $code)
    {
        $permissionId = DB::table('permissions')->where('code', $code)->value('id');

        return $permissionId
            ? DB::table('role_permissions')
                ->where('permission_id', $permissionId)
                ->whereNull('deleted_at')
                ->pluck('role_id')
            : collect();
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
