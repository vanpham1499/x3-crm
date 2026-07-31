<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        [
            'module' => 'cost',
            'code' => 'cost.manage',
            'name' => 'Nạp, cập nhật và hủy chi phí Project mình phụ trách',
        ],
        [
            'module' => 'cost',
            'code' => 'cost.manage_department',
            'name' => 'Nạp, cập nhật và hủy chi phí Project trong phòng ban',
        ],
        [
            'module' => 'cost',
            'code' => 'cost.manage_all',
            'name' => 'Nạp, cập nhật và hủy mọi chi phí Project',
        ],
    ];

    private const RECONCILIATION_PERMISSIONS = [
        'cost.approve' => 'Đối soát chi phí thuộc dự án mình phụ trách',
        'cost.approve_department' => 'Đối soát chi phí trong phòng ban',
        'cost.approve_all' => 'Đối soát mọi chi phí',
    ];

    private const PREVIOUS_RECONCILIATION_NAMES = [
        'cost.approve' => 'Duyệt chi phí thuộc dự án mình phụ trách',
        'cost.approve_department' => 'Duyệt chi phí trong phòng ban',
        'cost.approve_all' => 'Duyệt mọi chi phí',
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

            $this->renameReconciliationPermissions(self::RECONCILIATION_PERMISSIONS, $now);

            $adminRoleIds = DB::table('roles')
                ->where('name', 'ADMIN')
                ->whereNull('deleted_at')
                ->pluck('id');
            $this->grant($adminRoleIds, array_column(self::PERMISSIONS, 'code'), $now);

            $leaderRoleIds = DB::table('roles')
                ->where('name', 'LEADER')
                ->whereNull('deleted_at')
                ->pluck('id');
            $this->grant($leaderRoleIds, [
                'cost.manage',
                'cost.manage_department',
            ], $now);
        });
    }

    public function down(): void
    {
        $this->renameReconciliationPermissions(self::PREVIOUS_RECONCILIATION_NAMES, now());

        $permissionIds = DB::table('permissions')
            ->whereIn('code', array_column(self::PERMISSIONS, 'code'))
            ->pluck('id');

        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }

    private function renameReconciliationPermissions(array $permissions, $now): void
    {
        foreach ($permissions as $code => $name) {
            DB::table('permissions')
                ->where('code', $code)
                ->update([
                    'name' => $name,
                    'description' => 'Quyền '.$name,
                    'updated_at' => $now,
                ]);
        }
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
