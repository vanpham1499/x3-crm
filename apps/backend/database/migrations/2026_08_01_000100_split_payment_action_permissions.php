<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        [
            'module' => 'payment',
            'code' => 'payment.allocate',
            'name' => 'Phân bổ / hủy phân bổ báo phí',
        ],
        [
            'module' => 'payment',
            'code' => 'payment.refund.create',
            'name' => 'Tạo khoản trả khách',
        ],
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

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

            $managePermissionId = DB::table('permissions')
                ->where('code', 'payment.manage')
                ->value('id');
            $roleIds = $managePermissionId
                ? DB::table('role_permissions')
                    ->where('permission_id', $managePermissionId)
                    ->whereNull('deleted_at')
                    ->pluck('role_id')
                : collect();
            $permissionIds = DB::table('permissions')
                ->whereIn('code', array_column(self::PERMISSIONS, 'code'))
                ->pluck('id');
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
        });
    }

    public function down(): void
    {
        $permissionIds = DB::table('permissions')
            ->whereIn('code', array_column(self::PERMISSIONS, 'code'))
            ->pluck('id');

        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }
};
