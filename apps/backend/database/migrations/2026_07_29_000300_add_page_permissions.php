<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        ['module' => 'dashboard', 'code' => 'dashboard.view', 'name' => 'Xem Dashboard'],
        ['module' => 'payment', 'code' => 'payment.view', 'name' => 'Xem trang Thanh toán'],
        ['module' => 'cost', 'code' => 'cost.view', 'name' => 'Xem trang Chi phí'],
        ['module' => 'media', 'code' => 'media.view', 'name' => 'Xem trang Thư viện'],
        ['module' => 'department', 'code' => 'department.view', 'name' => 'Xem trang Phòng ban'],
        ['module' => 'option', 'code' => 'option.view', 'name' => 'Xem trang Danh mục chung'],
        ['module' => 'service', 'code' => 'service.view', 'name' => 'Xem trang Dịch vụ'],
        ['module' => 'partner', 'code' => 'partner.view', 'name' => 'Xem trang Đối tác'],
        ['module' => 'bankaccount', 'code' => 'bankaccount.view', 'name' => 'Xem trang Ngân hàng'],
        ['module' => 'adtopupcard', 'code' => 'adtopupcard.view', 'name' => 'Xem trang Thẻ nạp quảng cáo'],
        ['module' => 'p2category', 'code' => 'p2category.view', 'name' => 'Xem trang Hạng mục P2'],
        ['module' => 'lookup', 'code' => 'user.lookup', 'name' => 'Tra cứu nhân sự trong biểu mẫu'],
        ['module' => 'lookup', 'code' => 'department.lookup', 'name' => 'Tra cứu phòng ban trong biểu mẫu'],
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

            $allRoleIds = DB::table('roles')->whereNull('deleted_at')->pluck('id');
            $this->grant($allRoleIds, ['payment.view', 'media.view', 'user.lookup', 'department.lookup'], $now);

            $this->grantFromExistingPermission('kpi.view', ['dashboard.view'], $now);
            $this->grantFromExistingPermission('project.view', ['cost.view'], $now);
            $this->grantFromExistingPermission('user.view', ['department.view'], $now);
            $this->grantFromExistingPermission('option.manage', [
                'option.view',
                'service.view',
                'partner.view',
                'bankaccount.view',
                'adtopupcard.view',
                'p2category.view',
            ], $now);
        });
    }

    public function down(): void
    {
        $codes = array_column(self::PERMISSIONS, 'code');
        $permissionIds = DB::table('permissions')->whereIn('code', $codes)->pluck('id');

        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }

    private function grantFromExistingPermission(string $sourceCode, array $targetCodes, $now): void
    {
        $sourcePermissionId = DB::table('permissions')->where('code', $sourceCode)->value('id');

        if (! $sourcePermissionId) {
            return;
        }

        $roleIds = DB::table('role_permissions')
            ->where('permission_id', $sourcePermissionId)
            ->whereNull('deleted_at')
            ->pluck('role_id');

        $this->grant($roleIds, $targetCodes, $now);
    }

    private function grant($roleIds, array $codes, $now): void
    {
        if ($roleIds->isEmpty()) {
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
