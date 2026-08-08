<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        'cost.view_department' => 'Xem chi phí trong phòng ban',
        'cost.view_all' => 'Xem mọi chi phí',
        'cost.fund' => 'Xác nhận đã nạp/đã chi',
        'cost.fund_department' => 'Xác nhận đã nạp/đã chi trong phòng ban',
        'cost.fund_all' => 'Xác nhận mọi khoản đã nạp/đã chi',
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            DB::table('permissions')
                ->where('code', 'cost.view')
                ->update([
                    'name' => 'Xem chi phí của mình',
                    'description' => 'Mở trang Chi phí và xem khoản chi của mình hoặc dự án mình phụ trách',
                    'updated_at' => $now,
                ]);

            foreach (self::PERMISSIONS as $code => $name) {
                DB::table('permissions')->updateOrInsert(
                    ['code' => $code],
                    [
                        'module' => 'cost',
                        'name' => $name,
                        'description' => 'Quyền '.$name,
                        'deleted_at' => null,
                        'deleted_by' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                );
            }

            $adminRoleIds = $this->roleIds(['ADMIN']);
            $this->grant($adminRoleIds, array_keys(self::PERMISSIONS), $now);

            $leaderRoleIds = $this->roleIds(['LEADER']);
            $this->grant($leaderRoleIds, [
                'cost.view',
                'cost.view_department',
                'cost.manage',
                'cost.manage_department',
                'cost.fund',
                'cost.fund_department',
            ], $now);

            $employeeRoleIds = $this->roleIds(['EMPLOYEE', 'SALES']);
            $this->grant($employeeRoleIds, ['cost.manage'], $now);
            $this->revoke($employeeRoleIds, ['cost.view']);

            $accountantRoleIds = $this->roleIds(['ACCOUNTANT']);
            $this->grant($accountantRoleIds, [
                'cost.view',
                'cost.view_all',
                'cost.approve',
                'cost.approve_all',
            ], $now);
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
                ->where('code', 'cost.view')
                ->update([
                    'name' => 'Xem trang Chi phí',
                    'description' => 'Quyền Xem trang Chi phí',
                    'updated_at' => now(),
                ]);

            $this->grant($this->roleIds(['EMPLOYEE', 'SALES']), ['cost.view'], now());
        });
    }

    private function roleIds(array $names)
    {
        return DB::table('roles')
            ->whereIn('name', $names)
            ->whereNull('deleted_at')
            ->pluck('id');
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
