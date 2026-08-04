<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        ['module' => 'kpi', 'code' => 'kpi.view_department', 'name' => 'Xem KPI trong phòng ban'],
        ['module' => 'kpi', 'code' => 'kpi.view_all', 'name' => 'Xem toàn bộ KPI'],
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            DB::table('permissions')
                ->where('code', 'kpi.view')
                ->update([
                    'name' => 'Xem KPI của mình',
                    'description' => 'Quyền xem KPI của chính mình',
                    'updated_at' => $now,
                ]);

            foreach (self::PERMISSIONS as $permission) {
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
            $leaderRoleIds = DB::table('roles')
                ->where('name', 'LEADER')
                ->whereNull('deleted_at')
                ->pluck('id');
            $managePermissionId = DB::table('permissions')
                ->where('code', 'kpi.manage')
                ->value('id');
            $managerRoleIds = $managePermissionId
                ? DB::table('role_permissions')
                    ->where('permission_id', $managePermissionId)
                    ->whereNull('deleted_at')
                    ->pluck('role_id')
                : collect();

            $this->grant($adminRoleIds, array_column(self::PERMISSIONS, 'code'), $now);
            $this->grant($leaderRoleIds, ['kpi.view_department'], $now);
            $this->grant($managerRoleIds, ['kpi.view_all'], $now);
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $permissionIds = DB::table('permissions')
                ->whereIn('code', array_column(self::PERMISSIONS, 'code'))
                ->pluck('id');

            DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
            DB::table('permissions')->whereIn('id', $permissionIds)->delete();
            DB::table('permissions')
                ->where('code', 'kpi.view')
                ->update([
                    'name' => 'Xem KPI',
                    'description' => 'Quyền Xem KPI',
                    'updated_at' => now(),
                ]);
        });
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
};
