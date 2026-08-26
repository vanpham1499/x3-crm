<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const CODE = 'payment.delete';

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            DB::table('permissions')->updateOrInsert(
                ['code' => self::CODE],
                [
                    'module' => 'payment',
                    'name' => 'Xóa khoản thanh toán',
                    'description' => 'Quyền xóa khoản thanh toán chưa có phân bổ hoặc hoàn tiền',
                    'deleted_at' => null,
                    'deleted_by' => null,
                    'updated_at' => $now,
                    'created_at' => $now,
                ],
            );

            $permissionId = DB::table('permissions')->where('code', self::CODE)->value('id');
            $adminRoleId = DB::table('roles')->where('name', 'ADMIN')->whereNull('deleted_at')->value('id');

            if ($permissionId === null || $adminRoleId === null) {
                return;
            }

            DB::table('role_permissions')->upsert(
                [[
                    'role_id' => $adminRoleId,
                    'permission_id' => $permissionId,
                    'deleted_at' => null,
                    'deleted_by' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]],
                ['role_id', 'permission_id'],
                ['deleted_at', 'deleted_by', 'updated_at'],
            );
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
