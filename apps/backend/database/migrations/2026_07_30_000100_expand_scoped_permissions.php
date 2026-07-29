<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSIONS = [
        ['module' => 'meeting', 'code' => 'meeting.view_department', 'name' => 'Xem lịch hẹn trong phòng ban'],
        ['module' => 'meeting', 'code' => 'meeting.view_all', 'name' => 'Xem mọi lịch hẹn'],
        ['module' => 'meeting', 'code' => 'meeting.update_department', 'name' => 'Cập nhật lịch hẹn trong phòng ban'],
        ['module' => 'meeting', 'code' => 'meeting.delete_department', 'name' => 'Xóa lịch hẹn trong phòng ban'],

        ['module' => 'weeklyreport', 'code' => 'weeklyreport.view_department', 'name' => 'Xem báo cáo tuần trong phòng ban'],
        ['module' => 'weeklyreport', 'code' => 'weeklyreport.view_all', 'name' => 'Xem mọi báo cáo tuần'],
        ['module' => 'weeklyreport', 'code' => 'weeklyreport.update', 'name' => 'Cập nhật báo cáo tuần của mình'],
        ['module' => 'weeklyreport', 'code' => 'weeklyreport.update_department', 'name' => 'Cập nhật báo cáo tuần trong phòng ban'],
        ['module' => 'weeklyreport', 'code' => 'weeklyreport.update_all', 'name' => 'Cập nhật mọi báo cáo tuần'],
        ['module' => 'weeklyreport', 'code' => 'weeklyreport.delete', 'name' => 'Xóa báo cáo tuần của mình'],
        ['module' => 'weeklyreport', 'code' => 'weeklyreport.delete_department', 'name' => 'Xóa báo cáo tuần trong phòng ban'],
        ['module' => 'weeklyreport', 'code' => 'weeklyreport.delete_all', 'name' => 'Xóa mọi báo cáo tuần'],
        ['module' => 'weeklyreport', 'code' => 'weeklyreport.approve_department', 'name' => 'Duyệt báo cáo tuần trong phòng ban'],

        ['module' => 'media', 'code' => 'media.view_department', 'name' => 'Xem thư viện trong phòng ban'],
        ['module' => 'media', 'code' => 'media.view_all', 'name' => 'Xem toàn bộ thư viện'],
        ['module' => 'media', 'code' => 'media.create', 'name' => 'Thêm ảnh vào thư viện'],
        ['module' => 'media', 'code' => 'media.update', 'name' => 'Cập nhật ảnh của mình'],
        ['module' => 'media', 'code' => 'media.update_department', 'name' => 'Cập nhật ảnh trong phòng ban'],
        ['module' => 'media', 'code' => 'media.update_all', 'name' => 'Cập nhật mọi ảnh'],
        ['module' => 'media', 'code' => 'media.delete', 'name' => 'Xóa ảnh của mình'],
        ['module' => 'media', 'code' => 'media.delete_department', 'name' => 'Xóa ảnh trong phòng ban'],
        ['module' => 'media', 'code' => 'media.delete_all', 'name' => 'Xóa mọi ảnh'],

        ['module' => 'p2point', 'code' => 'p2point.view_department', 'name' => 'Xem điểm P2 trong phòng ban'],
        ['module' => 'p2point', 'code' => 'p2point.view_all', 'name' => 'Xem mọi điểm P2'],
        ['module' => 'p2point', 'code' => 'p2point.create_department', 'name' => 'Ghi nhận P2 trong phòng ban'],
        ['module' => 'p2point', 'code' => 'p2point.update', 'name' => 'Cập nhật điểm P2 thuộc phạm vi của mình'],
        ['module' => 'p2point', 'code' => 'p2point.update_department', 'name' => 'Cập nhật điểm P2 trong phòng ban'],
        ['module' => 'p2point', 'code' => 'p2point.update_all', 'name' => 'Cập nhật mọi điểm P2'],
        ['module' => 'p2point', 'code' => 'p2point.delete', 'name' => 'Xóa điểm P2 thuộc phạm vi của mình'],
        ['module' => 'p2point', 'code' => 'p2point.delete_department', 'name' => 'Xóa điểm P2 trong phòng ban'],
        ['module' => 'p2point', 'code' => 'p2point.delete_all', 'name' => 'Xóa mọi điểm P2'],
        ['module' => 'p2point', 'code' => 'p2point.approve_department', 'name' => 'Duyệt điểm P2 trong phòng ban'],

        ['module' => 'cost', 'code' => 'cost.approve', 'name' => 'Duyệt chi phí thuộc dự án mình phụ trách'],
        ['module' => 'cost', 'code' => 'cost.approve_department', 'name' => 'Duyệt chi phí trong phòng ban'],
        ['module' => 'cost', 'code' => 'cost.approve_all', 'name' => 'Duyệt mọi chi phí'],
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

            $this->grantFromExisting('weeklyreport.create', [
                'weeklyreport.update',
                'weeklyreport.delete',
            ], $now);
            $this->grantFromExisting('media.view', [
                'media.create',
                'media.update',
                'media.delete',
            ], $now);
            $this->grantFromExisting('p2point.create', [
                'p2point.update',
                'p2point.delete',
            ], $now);
            $this->grantFromExisting('meeting.update_all', ['meeting.view_all'], $now);
            $this->grantFromExisting('meeting.delete_all', ['meeting.view_all'], $now);
            $this->grantFromExisting('weeklyreport.approve_all', ['weeklyreport.view_all'], $now);
            $this->grantFromExisting('p2point.approve_all', ['p2point.view_all'], $now);
            $this->grantFromExisting('payment.manage', [
                'cost.approve',
                'cost.approve_all',
            ], $now);

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
                'meeting.view_department',
                'meeting.update_department',
                'meeting.delete_department',
                'weeklyreport.view_department',
                'weeklyreport.update_department',
                'weeklyreport.delete_department',
                'weeklyreport.approve_department',
                'media.view_department',
                'media.update_department',
                'media.delete_department',
                'p2point.view_department',
                'p2point.create_department',
                'p2point.update_department',
                'p2point.delete_department',
                'p2point.approve_department',
            ], $now);
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

    private function grantFromExisting(string $sourceCode, array $targetCodes, $now): void
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
