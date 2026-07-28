<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        ['code' => 'meeting.view', 'name' => 'Xem lịch hẹn'],
        ['code' => 'meeting.create', 'name' => 'Tạo lịch hẹn'],
        ['code' => 'meeting.update', 'name' => 'Cập nhật lịch hẹn thuộc phạm vi'],
        ['code' => 'meeting.update_all', 'name' => 'Cập nhật mọi lịch hẹn'],
        ['code' => 'meeting.delete', 'name' => 'Xóa lịch hẹn thuộc phạm vi'],
        ['code' => 'meeting.delete_all', 'name' => 'Xóa mọi lịch hẹn'],
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $now = now();

            foreach (self::PERMISSIONS as $permission) {
                DB::table('permissions')->updateOrInsert(
                    ['code' => $permission['code']],
                    [
                        'module' => 'meeting',
                        'name' => $permission['name'],
                        'description' => 'Quyền '.$permission['name'],
                        'updated_at' => $now,
                        'created_at' => $now,
                    ],
                );
            }

            $baseCodes = ['meeting.view', 'meeting.create', 'meeting.update', 'meeting.delete'];
            $roleCodes = [
                'ADMIN' => array_column(self::PERMISSIONS, 'code'),
                'LEADER' => $baseCodes,
                'EMPLOYEE' => $baseCodes,
                'SALES' => $baseCodes,
                'ACCOUNTANT' => $baseCodes,
            ];

            foreach ($roleCodes as $roleName => $codes) {
                $roleId = DB::table('roles')->where('name', $roleName)->value('id');

                if (! $roleId) {
                    continue;
                }

                $rows = DB::table('permissions')
                    ->whereIn('code', $codes)
                    ->pluck('id')
                    ->map(fn ($permissionId): array => [
                        'role_id' => $roleId,
                        'permission_id' => $permissionId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ])
                    ->all();

                DB::table('role_permissions')->insertOrIgnore($rows);
            }
        });
    }

    public function down(): void
    {
        $codes = array_column(self::PERMISSIONS, 'code');
        $permissionIds = DB::table('permissions')->whereIn('code', $codes)->pluck('id');

        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }
};
