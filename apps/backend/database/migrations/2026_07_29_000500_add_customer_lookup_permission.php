<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const CODE = 'customer.lookup';

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            DB::table('permissions')->updateOrInsert(
                ['code' => self::CODE],
                [
                    'module' => 'lookup',
                    'name' => 'Tra cứu khách hàng trong biểu mẫu',
                    'description' => 'Tra cứu khách hàng tối thiểu cho biểu mẫu dự án, không mở trang Khách hàng',
                    'deleted_at' => null,
                    'deleted_by' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );

            $lookupPermissionId = DB::table('permissions')
                ->where('code', self::CODE)
                ->value('id');

            $projectPermissionIds = DB::table('permissions')
                ->where('module', 'project')
                ->whereNull('deleted_at')
                ->pluck('id');

            $roleIds = DB::table('role_permissions')
                ->whereIn('permission_id', $projectPermissionIds)
                ->whereNull('deleted_at')
                ->pluck('role_id')
                ->unique();

            $rows = $roleIds->map(fn ($roleId): array => [
                'role_id' => $roleId,
                'permission_id' => $lookupPermissionId,
                'deleted_at' => null,
                'deleted_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

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
        DB::transaction(function (): void {
            $permissionId = DB::table('permissions')
                ->where('code', self::CODE)
                ->value('id');

            if (! $permissionId) {
                return;
            }

            DB::table('role_permissions')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        });
    }
};
