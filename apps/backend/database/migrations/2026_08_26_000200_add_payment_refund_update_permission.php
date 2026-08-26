<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const CODE = 'payment.refund.update';

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            DB::table('permissions')->updateOrInsert(
                ['code' => self::CODE],
                [
                    'module' => 'payment',
                    'name' => 'Chỉnh sửa khoản trả khách đang chờ',
                    'description' => 'Quyền chỉnh sửa nội dung khoản trả khách khi trạng thái còn chờ hoàn',
                    'deleted_at' => null,
                    'deleted_by' => null,
                    'updated_at' => $now,
                    'created_at' => $now,
                ],
            );

            $permissionId = DB::table('permissions')->where('code', self::CODE)->value('id');
            $sourcePermissionIds = DB::table('permissions')
                ->whereIn('code', ['payment.manage', 'payment.refund.create'])
                ->pluck('id');
            $roleIds = $sourcePermissionIds->isNotEmpty()
                ? DB::table('role_permissions')
                    ->whereIn('permission_id', $sourcePermissionIds)
                    ->whereNull('deleted_at')
                    ->pluck('role_id')
                    ->unique()
                : collect();
            $rows = $roleIds
                ->map(fn ($roleId): array => [
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
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
        $permissionId = DB::table('permissions')->where('code', self::CODE)->value('id');

        if ($permissionId === null) {
            return;
        }

        DB::table('role_permissions')->where('permission_id', $permissionId)->delete();
        DB::table('permissions')->where('id', $permissionId)->delete();
    }
};
