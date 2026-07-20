<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            User::ROLE_ADMIN => 'Quản trị hệ thống',
            User::ROLE_LEADER => 'Trưởng nhóm',
            User::ROLE_EMPLOYEE => 'Nhân sự',
            User::ROLE_ACCOUNTANT => 'Kế toán',
            User::ROLE_SALES => 'Sales',
        ];

        $roleIds = [];

        foreach ($roles as $name => $description) {
            DB::table('roles')->updateOrInsert(
                ['name' => $name],
                [
                    'description' => $description,
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );

            $roleIds[$name] = DB::table('roles')->where('name', $name)->value('id');
        }

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

        $permissionIds = [];

        foreach ($permissions as $permission) {
            DB::table('permissions')->updateOrInsert(
                ['code' => $permission['code']],
                [
                    'name' => $permission['name'],
                    'module' => $permission['module'],
                    'description' => 'Quyền '.$permission['name'],
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );

            $permissionIds[$permission['code']] = DB::table('permissions')->where('code', $permission['code'])->value('id');
        }

        // Base codes are ownership-gated (record must belong to the user); "_all" codes
        // bypass ownership entirely and are reserved for elevated roles.
        $baseCodes = [
            'lead.view', 'lead.create', 'lead.update', 'lead.delete',
            'customer.view', 'customer.create', 'customer.update', 'customer.delete',
            'project.view', 'project.create', 'project.update', 'project.delete',
            'quotation.view', 'quotation.create', 'quotation.update', 'quotation.delete',
            'weeklyreport.view', 'weeklyreport.create', 'weeklyreport.approve',
            'kpipoint.view', 'kpipoint.create', 'kpipoint.approve',
        ];

        $rolePermissionCodes = [
            User::ROLE_ADMIN => array_column($permissions, 'code'),
            User::ROLE_LEADER => array_merge($baseCodes, [
                'lead.update_all', 'lead.delete_all',
                'customer.update_all', 'customer.delete_all',
                'quotation.update_all', 'quotation.delete_all',
                'user.view',
            ]),
            User::ROLE_EMPLOYEE => $baseCodes,
            User::ROLE_SALES => $baseCodes,
            User::ROLE_ACCOUNTANT => array_merge($baseCodes, ['payment.manage']),
        ];

        foreach ($rolePermissionCodes as $roleName => $codes) {
            foreach ($codes as $code) {
                if (! isset($permissionIds[$code])) {
                    continue;
                }

                $roleId = $roleIds[$roleName];
                $permissionId = $permissionIds[$code];

                if (! DB::table('role_permissions')->where('role_id', $roleId)->where('permission_id', $permissionId)->exists()) {
                    DB::table('role_permissions')->insert([
                        'role_id' => $roleId,
                        'permission_id' => $permissionId,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }

        $users = [
            [
                'code' => 'NV000',
                'name' => 'Admin X3',
                'email' => 'admin@x3crm.com',
                'password' => 'Admin@123',
                'role' => User::ROLE_ADMIN,
            ],
            [
                'code' => 'NV001',
                'name' => 'Nguyễn Đức Hòa',
                'email' => 'leader@x3crm.com',
                'password' => 'Leader@123',
                'role' => User::ROLE_LEADER,
            ],
            [
                'code' => 'NV002',
                'name' => 'Phạm Ngọc An',
                'email' => 'nv002@x3crm.com',
                'password' => 'Nv002@123',
                'role' => User::ROLE_EMPLOYEE,
            ],
            [
                'code' => 'NV003',
                'name' => 'Ngô Quang Huỳnh',
                'email' => 'nv003@x3crm.com',
                'password' => 'Nv003@123',
                'role' => User::ROLE_EMPLOYEE,
            ],
            [
                'code' => 'NV010',
                'name' => 'Kế Toán',
                'email' => 'ketoan@x3crm.com',
                'password' => 'Ketoan@123',
                'role' => User::ROLE_ACCOUNTANT,
            ],
        ];

        foreach ($users as $user) {
            User::query()->updateOrCreate(
                ['email' => $user['email']],
                [
                    'code' => $user['code'],
                    'name' => $user['name'],
                    'password' => Hash::make($user['password']),
                    'role' => $user['role'],
                    'role_id' => $roleIds[$user['role']],
                    'is_active' => true,
                ],
            );
        }
    }
}
