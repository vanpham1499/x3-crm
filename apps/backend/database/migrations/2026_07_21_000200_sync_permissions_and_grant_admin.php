<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $permissions = [
            ['module' => 'user', 'code' => 'user.view', 'name' => 'Xem nhân sự'],
            ['module' => 'user', 'code' => 'user.create', 'name' => 'Tạo nhân sự'],
            ['module' => 'user', 'code' => 'user.update', 'name' => 'Cập nhật nhân sự'],
            ['module' => 'user', 'code' => 'user.delete', 'name' => 'Xóa nhân sự'],
            ['module' => 'role', 'code' => 'role.view', 'name' => 'Xem vai trò'],
            ['module' => 'role', 'code' => 'role.create', 'name' => 'Tạo vai trò'],
            ['module' => 'role', 'code' => 'role.update', 'name' => 'Cập nhật vai trò'],
            ['module' => 'role', 'code' => 'role.delete', 'name' => 'Xóa vai trò'],
            ['module' => 'role', 'code' => 'role.permission.update', 'name' => 'Cập nhật quyền vai trò'],
            ['module' => 'permission', 'code' => 'permission.view', 'name' => 'Xem danh sách quyền'],

            ['module' => 'lead', 'code' => 'lead.view', 'name' => 'Xem lead'],
            ['module' => 'lead', 'code' => 'lead.create', 'name' => 'Tạo lead'],
            ['module' => 'lead', 'code' => 'lead.update', 'name' => 'Cập nhật lead của mình'],
            ['module' => 'lead', 'code' => 'lead.update_all', 'name' => 'Cập nhật mọi lead'],
            ['module' => 'lead', 'code' => 'lead.delete', 'name' => 'Xóa lead của mình'],
            ['module' => 'lead', 'code' => 'lead.delete_all', 'name' => 'Xóa mọi lead'],

            ['module' => 'customer', 'code' => 'customer.view', 'name' => 'Xem khách hàng'],
            ['module' => 'customer', 'code' => 'customer.create', 'name' => 'Tạo khách hàng'],
            ['module' => 'customer', 'code' => 'customer.update', 'name' => 'Cập nhật khách hàng của mình'],
            ['module' => 'customer', 'code' => 'customer.update_all', 'name' => 'Cập nhật mọi khách hàng'],
            ['module' => 'customer', 'code' => 'customer.delete', 'name' => 'Xóa khách hàng của mình'],
            ['module' => 'customer', 'code' => 'customer.delete_all', 'name' => 'Xóa mọi khách hàng'],

            ['module' => 'project', 'code' => 'project.view', 'name' => 'Xem dự án'],
            ['module' => 'project', 'code' => 'project.create', 'name' => 'Tạo dự án'],
            ['module' => 'project', 'code' => 'project.update', 'name' => 'Cập nhật dự án của mình'],
            ['module' => 'project', 'code' => 'project.update_all', 'name' => 'Cập nhật mọi dự án'],
            ['module' => 'project', 'code' => 'project.delete', 'name' => 'Xóa dự án của mình'],
            ['module' => 'project', 'code' => 'project.delete_all', 'name' => 'Xóa mọi dự án'],

            ['module' => 'quotation', 'code' => 'quotation.view', 'name' => 'Xem báo phí'],
            ['module' => 'quotation', 'code' => 'quotation.create', 'name' => 'Tạo báo phí'],
            ['module' => 'quotation', 'code' => 'quotation.update', 'name' => 'Cập nhật báo phí của mình'],
            ['module' => 'quotation', 'code' => 'quotation.update_all', 'name' => 'Cập nhật mọi báo phí'],
            ['module' => 'quotation', 'code' => 'quotation.delete', 'name' => 'Xóa báo phí của mình'],
            ['module' => 'quotation', 'code' => 'quotation.delete_all', 'name' => 'Xóa mọi báo phí'],

            ['module' => 'weeklyreport', 'code' => 'weeklyreport.view', 'name' => 'Xem báo cáo tuần'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.create', 'name' => 'Tạo báo cáo tuần'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.approve', 'name' => 'Duyệt báo cáo tuần (dự án mình quản lý)'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.approve_all', 'name' => 'Duyệt mọi báo cáo tuần'],

            ['module' => 'kpipoint', 'code' => 'kpipoint.view', 'name' => 'Xem điểm KPI'],
            ['module' => 'kpipoint', 'code' => 'kpipoint.create', 'name' => 'Ghi nhận KPI (dự án mình quản lý)'],
            ['module' => 'kpipoint', 'code' => 'kpipoint.create_all', 'name' => 'Ghi nhận KPI không cần dự án'],
            ['module' => 'kpipoint', 'code' => 'kpipoint.approve', 'name' => 'Duyệt KPI (dự án mình quản lý)'],
            ['module' => 'kpipoint', 'code' => 'kpipoint.approve_all', 'name' => 'Duyệt mọi điểm KPI'],

            ['module' => 'payment', 'code' => 'payment.manage', 'name' => 'Đối soát / chốt thanh toán'],
            ['module' => 'option', 'code' => 'option.manage', 'name' => 'Quản lý danh mục hệ thống'],
        ];

        DB::transaction(function () use ($permissions): void {
            $now = now();

            foreach ($permissions as $permission) {
                DB::table('permissions')->updateOrInsert(
                    ['code' => $permission['code']],
                    [
                        'module' => $permission['module'],
                        'name' => $permission['name'],
                        'description' => 'Quyền '.$permission['name'],
                        'updated_at' => $now,
                        'created_at' => $now,
                    ],
                );
            }

            $adminRoleId = DB::table('roles')->where('name', 'ADMIN')->value('id');

            if (! $adminRoleId) {
                return;
            }

            $rows = DB::table('permissions')
                ->pluck('id')
                ->map(fn ($permissionId): array => [
                    'role_id' => $adminRoleId,
                    'permission_id' => $permissionId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
                ->all();

            DB::table('role_permissions')->insertOrIgnore($rows);

            DB::table('users')
                ->where('role', 'ADMIN')
                ->update([
                    'role_id' => $adminRoleId,
                    'updated_at' => $now,
                ]);
        });
    }

    public function down(): void
    {
        // Do not revoke access or delete shared permissions during rollback.
    }
};
