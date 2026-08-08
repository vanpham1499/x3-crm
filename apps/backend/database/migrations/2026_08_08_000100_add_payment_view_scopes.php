<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        [
            'module' => 'payment',
            'code' => 'payment.view_department',
            'name' => 'Xem thanh toán dự án trong phòng ban',
        ],
        [
            'module' => 'payment',
            'code' => 'payment.view_all',
            'name' => 'Xem mọi khoản thanh toán',
        ],
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            DB::table('permissions')
                ->where('code', 'payment.view')
                ->update([
                    'name' => 'Xem khoản mồ côi và thanh toán dự án mình quản lý',
                    'description' => 'Xem khoản mồ côi cần xác nhận và thanh toán thuộc dự án mình quản lý',
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

            $leaderRoleIds = DB::table('roles')
                ->where('name', 'LEADER')
                ->whereNull('deleted_at')
                ->pluck('id');
            $this->grant($leaderRoleIds, ['payment.view_department'], $now);

            $managePermissionId = DB::table('permissions')
                ->where('code', 'payment.manage')
                ->value('id');
            $manageRoleIds = $managePermissionId
                ? DB::table('role_permissions')
                    ->where('permission_id', $managePermissionId)
                    ->whereNull('deleted_at')
                    ->pluck('role_id')
                : collect();
            $this->grant($manageRoleIds, ['payment.view_all'], $now);

            $adminRoleIds = DB::table('roles')
                ->where('name', 'ADMIN')
                ->whereNull('deleted_at')
                ->pluck('id');
            $this->grant($adminRoleIds, array_column(self::PERMISSIONS, 'code'), $now);
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
                ->where('code', 'payment.view')
                ->update([
                    'name' => 'Xem trang Thanh toán',
                    'description' => 'Quyền Xem trang Thanh toán',
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
