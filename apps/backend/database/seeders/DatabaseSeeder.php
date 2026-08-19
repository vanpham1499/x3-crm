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
            ['module' => 'cost', 'code' => 'cost.manage', 'name' => 'Nạp, cập nhật chi phí'],
            ['module' => 'cost', 'code' => 'cost.manage_department', 'name' => 'Nạp, cập nhật chi phí trong phòng ban'],
            ['module' => 'cost', 'code' => 'cost.manage_all', 'name' => 'Nạp, cập nhật mọi chi phí'],
            ['module' => 'cost', 'code' => 'cost.fund', 'name' => 'Xác nhận đã nạp/đã chi'],
            ['module' => 'cost', 'code' => 'cost.fund_department', 'name' => 'Xác nhận đã nạp/đã chi trong phòng ban'],
            ['module' => 'cost', 'code' => 'cost.fund_all', 'name' => 'Xác nhận mọi khoản đã nạp/đã chi'],
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

            ['module' => 'dashboard', 'code' => 'dashboard.view', 'name' => 'Xem Dashboard'],
            ['module' => 'payment', 'code' => 'payment.view', 'name' => 'Xem khoản mồ côi và thanh toán dự án mình quản lý'],
            ['module' => 'payment', 'code' => 'payment.view_department', 'name' => 'Xem thanh toán dự án trong phòng ban'],
            ['module' => 'payment', 'code' => 'payment.view_all', 'name' => 'Xem mọi khoản thanh toán'],
            ['module' => 'cost', 'code' => 'cost.view', 'name' => 'Xem chi phí của mình'],
            ['module' => 'cost', 'code' => 'cost.view_department', 'name' => 'Xem chi phí trong phòng ban'],
            ['module' => 'cost', 'code' => 'cost.view_all', 'name' => 'Xem mọi chi phí'],
            ['module' => 'cost', 'code' => 'cost.approve', 'name' => 'Đối soát chi phí'],
            ['module' => 'cost', 'code' => 'cost.approve_department', 'name' => 'Đối soát chi phí trong phòng ban'],
            ['module' => 'cost', 'code' => 'cost.approve_all', 'name' => 'Đối soát mọi chi phí'],
            ['module' => 'media', 'code' => 'media.view', 'name' => 'Xem trang Thư viện'],
            ['module' => 'media', 'code' => 'media.view_department', 'name' => 'Xem thư viện trong phòng ban'],
            ['module' => 'media', 'code' => 'media.view_all', 'name' => 'Xem toàn bộ thư viện'],
            ['module' => 'media', 'code' => 'media.create', 'name' => 'Thêm ảnh vào thư viện'],
            ['module' => 'media', 'code' => 'media.update', 'name' => 'Cập nhật ảnh của mình'],
            ['module' => 'media', 'code' => 'media.update_department', 'name' => 'Cập nhật ảnh trong phòng ban'],
            ['module' => 'media', 'code' => 'media.update_all', 'name' => 'Cập nhật mọi ảnh'],
            ['module' => 'media', 'code' => 'media.delete', 'name' => 'Xóa ảnh của mình'],
            ['module' => 'media', 'code' => 'media.delete_department', 'name' => 'Xóa ảnh trong phòng ban'],
            ['module' => 'media', 'code' => 'media.delete_all', 'name' => 'Xóa mọi ảnh'],
            ['module' => 'department', 'code' => 'department.view', 'name' => 'Xem trang Phòng ban'],
            ['module' => 'option', 'code' => 'option.view', 'name' => 'Xem trang Danh mục chung'],
            ['module' => 'service', 'code' => 'service.view', 'name' => 'Xem trang Dịch vụ'],
            ['module' => 'partner', 'code' => 'partner.view', 'name' => 'Xem trang Đối tác'],
            ['module' => 'bankaccount', 'code' => 'bankaccount.view', 'name' => 'Xem trang Ngân hàng'],
            ['module' => 'adtopupcard', 'code' => 'adtopupcard.view', 'name' => 'Xem trang Thẻ nạp quảng cáo'],
            ['module' => 'p2category', 'code' => 'p2category.view', 'name' => 'Xem trang Hạng mục P2'],
            ['module' => 'lookup', 'code' => 'user.lookup', 'name' => 'Tra cứu nhân sự trong biểu mẫu'],
            ['module' => 'lookup', 'code' => 'department.lookup', 'name' => 'Tra cứu phòng ban trong biểu mẫu'],
            ['module' => 'lookup', 'code' => 'customer.lookup', 'name' => 'Tra cứu khách hàng trong biểu mẫu'],

            ['module' => 'lead', 'code' => 'lead.view', 'name' => 'Xem lead'],
            ['module' => 'lead', 'code' => 'lead.view_department', 'name' => 'Xem lead trong phòng ban'],
            ['module' => 'lead', 'code' => 'lead.view_all', 'name' => 'Xem mọi lead'],
            ['module' => 'lead', 'code' => 'lead.create', 'name' => 'Tạo lead'],
            ['module' => 'lead', 'code' => 'lead.update', 'name' => 'Cập nhật lead của mình'],
            ['module' => 'lead', 'code' => 'lead.update_department', 'name' => 'Cập nhật lead trong phòng ban'],
            ['module' => 'lead', 'code' => 'lead.update_all', 'name' => 'Cập nhật mọi lead'],
            ['module' => 'lead', 'code' => 'lead.delete', 'name' => 'Xóa lead của mình'],
            ['module' => 'lead', 'code' => 'lead.delete_department', 'name' => 'Xóa lead trong phòng ban'],
            ['module' => 'lead', 'code' => 'lead.delete_all', 'name' => 'Xóa mọi lead'],

            ['module' => 'customer', 'code' => 'customer.view', 'name' => 'Xem khách hàng'],
            ['module' => 'customer', 'code' => 'customer.view_department', 'name' => 'Xem khách hàng trong phòng ban'],
            ['module' => 'customer', 'code' => 'customer.view_all', 'name' => 'Xem mọi khách hàng'],
            ['module' => 'customer', 'code' => 'customer.create', 'name' => 'Tạo khách hàng'],
            ['module' => 'customer', 'code' => 'customer.update', 'name' => 'Cập nhật khách hàng của mình'],
            ['module' => 'customer', 'code' => 'customer.update_department', 'name' => 'Cập nhật khách hàng trong phòng ban'],
            ['module' => 'customer', 'code' => 'customer.update_all', 'name' => 'Cập nhật mọi khách hàng'],
            ['module' => 'customer', 'code' => 'customer.delete', 'name' => 'Xóa khách hàng của mình'],
            ['module' => 'customer', 'code' => 'customer.delete_department', 'name' => 'Xóa khách hàng trong phòng ban'],
            ['module' => 'customer', 'code' => 'customer.delete_all', 'name' => 'Xóa mọi khách hàng'],

            ['module' => 'project', 'code' => 'project.view', 'name' => 'Xem dự án'],
            ['module' => 'project', 'code' => 'project.view_department', 'name' => 'Xem dự án trong phòng ban'],
            ['module' => 'project', 'code' => 'project.view_all', 'name' => 'Xem mọi dự án'],
            ['module' => 'project', 'code' => 'project.create', 'name' => 'Tạo dự án'],
            ['module' => 'project', 'code' => 'project.update', 'name' => 'Cập nhật dự án của mình'],
            ['module' => 'project', 'code' => 'project.update_department', 'name' => 'Cập nhật dự án trong phòng ban'],
            ['module' => 'project', 'code' => 'project.update_all', 'name' => 'Cập nhật mọi dự án'],
            ['module' => 'project', 'code' => 'project.delete', 'name' => 'Xóa dự án của mình'],
            ['module' => 'project', 'code' => 'project.delete_department', 'name' => 'Xóa dự án trong phòng ban'],
            ['module' => 'project', 'code' => 'project.delete_all', 'name' => 'Xóa mọi dự án'],

            ['module' => 'quotation', 'code' => 'quotation.view', 'name' => 'Xem báo phí'],
            ['module' => 'quotation', 'code' => 'quotation.view_department', 'name' => 'Xem báo phí trong phòng ban'],
            ['module' => 'quotation', 'code' => 'quotation.view_all', 'name' => 'Xem mọi báo phí'],
            ['module' => 'quotation', 'code' => 'quotation.create', 'name' => 'Tạo báo phí'],
            ['module' => 'quotation', 'code' => 'quotation.update', 'name' => 'Cập nhật báo phí của mình'],
            ['module' => 'quotation', 'code' => 'quotation.update_department', 'name' => 'Cập nhật báo phí trong phòng ban'],
            ['module' => 'quotation', 'code' => 'quotation.update_all', 'name' => 'Cập nhật mọi báo phí'],
            ['module' => 'quotation', 'code' => 'quotation.delete', 'name' => 'Xóa báo phí của mình'],
            ['module' => 'quotation', 'code' => 'quotation.delete_department', 'name' => 'Xóa báo phí trong phòng ban'],
            ['module' => 'quotation', 'code' => 'quotation.delete_all', 'name' => 'Xóa mọi báo phí'],
            ['module' => 'quotation', 'code' => 'quotation.approve_topup_credit', 'name' => 'Duyệt hạn mức nợ để nạp ngân sách'],

            ['module' => 'weeklyreport', 'code' => 'weeklyreport.view', 'name' => 'Xem báo cáo tuần'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.view_department', 'name' => 'Xem báo cáo tuần trong phòng ban'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.view_all', 'name' => 'Xem mọi báo cáo tuần'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.create', 'name' => 'Tạo báo cáo tuần'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.update', 'name' => 'Cập nhật báo cáo tuần của mình'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.update_department', 'name' => 'Cập nhật báo cáo tuần trong phòng ban'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.update_all', 'name' => 'Cập nhật mọi báo cáo tuần'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.delete', 'name' => 'Xóa báo cáo tuần của mình'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.delete_department', 'name' => 'Xóa báo cáo tuần trong phòng ban'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.delete_all', 'name' => 'Xóa mọi báo cáo tuần'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.approve', 'name' => 'Duyệt báo cáo tuần (dự án mình quản lý)'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.approve_department', 'name' => 'Duyệt báo cáo tuần trong phòng ban'],
            ['module' => 'weeklyreport', 'code' => 'weeklyreport.approve_all', 'name' => 'Duyệt mọi báo cáo tuần'],

            ['module' => 'meeting', 'code' => 'meeting.view', 'name' => 'Xem lịch hẹn'],
            ['module' => 'meeting', 'code' => 'meeting.view_department', 'name' => 'Xem lịch hẹn trong phòng ban'],
            ['module' => 'meeting', 'code' => 'meeting.view_all', 'name' => 'Xem mọi lịch hẹn'],
            ['module' => 'meeting', 'code' => 'meeting.create', 'name' => 'Tạo lịch hẹn'],
            ['module' => 'meeting', 'code' => 'meeting.update', 'name' => 'Cập nhật lịch hẹn thuộc phạm vi'],
            ['module' => 'meeting', 'code' => 'meeting.update_department', 'name' => 'Cập nhật lịch hẹn trong phòng ban'],
            ['module' => 'meeting', 'code' => 'meeting.update_all', 'name' => 'Cập nhật mọi lịch hẹn'],
            ['module' => 'meeting', 'code' => 'meeting.delete', 'name' => 'Xóa lịch hẹn thuộc phạm vi'],
            ['module' => 'meeting', 'code' => 'meeting.delete_department', 'name' => 'Xóa lịch hẹn trong phòng ban'],
            ['module' => 'meeting', 'code' => 'meeting.delete_all', 'name' => 'Xóa mọi lịch hẹn'],

            ['module' => 'p2point', 'code' => 'p2point.view', 'name' => 'Xem điểm P2'],
            ['module' => 'p2point', 'code' => 'p2point.view_department', 'name' => 'Xem điểm P2 trong phòng ban'],
            ['module' => 'p2point', 'code' => 'p2point.view_all', 'name' => 'Xem mọi điểm P2'],
            ['module' => 'p2point', 'code' => 'p2point.create', 'name' => 'Ghi nhận P2 (dự án mình quản lý)'],
            ['module' => 'p2point', 'code' => 'p2point.create_department', 'name' => 'Ghi nhận P2 trong phòng ban'],
            ['module' => 'p2point', 'code' => 'p2point.create_all', 'name' => 'Ghi nhận P2 không cần dự án'],
            ['module' => 'p2point', 'code' => 'p2point.update', 'name' => 'Cập nhật điểm P2 thuộc phạm vi của mình'],
            ['module' => 'p2point', 'code' => 'p2point.update_department', 'name' => 'Cập nhật điểm P2 trong phòng ban'],
            ['module' => 'p2point', 'code' => 'p2point.update_all', 'name' => 'Cập nhật mọi điểm P2'],
            ['module' => 'p2point', 'code' => 'p2point.delete', 'name' => 'Xóa điểm P2 thuộc phạm vi của mình'],
            ['module' => 'p2point', 'code' => 'p2point.delete_department', 'name' => 'Xóa điểm P2 trong phòng ban'],
            ['module' => 'p2point', 'code' => 'p2point.delete_all', 'name' => 'Xóa mọi điểm P2'],
            ['module' => 'p2point', 'code' => 'p2point.approve', 'name' => 'Duyệt P2 (dự án mình quản lý)'],
            ['module' => 'p2point', 'code' => 'p2point.approve_department', 'name' => 'Duyệt điểm P2 trong phòng ban'],
            ['module' => 'p2point', 'code' => 'p2point.approve_all', 'name' => 'Duyệt mọi điểm P2'],

            ['module' => 'kpi', 'code' => 'kpi.view', 'name' => 'Xem KPI của mình'],
            ['module' => 'kpi', 'code' => 'kpi.view_department', 'name' => 'Xem KPI trong phòng ban'],
            ['module' => 'kpi', 'code' => 'kpi.view_all', 'name' => 'Xem toàn bộ KPI'],
            ['module' => 'kpi', 'code' => 'kpi.manage', 'name' => 'Lập KPI của mình'],
            ['module' => 'kpi', 'code' => 'kpi.manage_department', 'name' => 'Lập KPI trong phòng ban'],
            ['module' => 'kpi', 'code' => 'kpi.manage_all', 'name' => 'Lập toàn bộ KPI'],

            ['module' => 'payment', 'code' => 'payment.manage', 'name' => 'Đối soát / chốt thanh toán'],
            ['module' => 'payment', 'code' => 'payment.allocate', 'name' => 'Phân bổ / hủy phân bổ báo phí'],
            ['module' => 'payment', 'code' => 'payment.refund.create', 'name' => 'Tạo khoản trả khách'],

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
                    'deleted_at' => null,
                    'deleted_by' => null,
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );

            $permissionIds[$permission['code']] = DB::table('permissions')->where('code', $permission['code'])->value('id');
        }

        // Base codes are ownership-gated. "_department" expands the same action to
        // records assigned inside the user's department; "_all" bypasses ownership.
        $baseCodes = [
            'lead.view', 'lead.create', 'lead.update', 'lead.delete',
            'customer.view', 'customer.create', 'customer.update', 'customer.delete',
            'project.view', 'project.create', 'project.update', 'project.delete',
            'quotation.view', 'quotation.create', 'quotation.update', 'quotation.delete',
            'weeklyreport.view', 'weeklyreport.create', 'weeklyreport.update', 'weeklyreport.delete', 'weeklyreport.approve',
            'meeting.view', 'meeting.create', 'meeting.update', 'meeting.delete',
            'p2point.view', 'p2point.create', 'p2point.update', 'p2point.delete', 'p2point.approve',
            'kpi.view', 'dashboard.view',
            'payment.view', 'media.view', 'media.create', 'media.update', 'media.delete',
            'user.lookup', 'department.lookup', 'customer.lookup',
        ];

        $rolePermissionCodes = [
            User::ROLE_ADMIN => array_column($permissions, 'code'),
            User::ROLE_LEADER => array_merge($baseCodes, [
                'cost.view', 'cost.view_department',
                'cost.manage', 'cost.manage_department',
                'cost.fund', 'cost.fund_department',
                'lead.view_department', 'lead.update_department', 'lead.delete_department',
                'customer.view_department', 'customer.update_department', 'customer.delete_department',
                'project.view_department', 'project.update_department', 'project.delete_department',
                'quotation.view_department', 'quotation.update_department', 'quotation.delete_department',
                'quotation.approve_topup_credit',
                'payment.view_department',
                'meeting.view_department', 'meeting.update_department', 'meeting.delete_department',
                'weeklyreport.view_department', 'weeklyreport.update_department', 'weeklyreport.delete_department', 'weeklyreport.approve_department',
                'p2point.view_department', 'p2point.create_department', 'p2point.update_department', 'p2point.delete_department', 'p2point.approve_department',
                'kpi.view_department', 'kpi.manage', 'kpi.manage_department',
                'media.view_department', 'media.update_department', 'media.delete_department',
                'user.view', 'department.view',
            ]),
            User::ROLE_EMPLOYEE => array_merge($baseCodes, ['cost.manage']),
            User::ROLE_SALES => array_merge($baseCodes, ['cost.manage']),
            User::ROLE_ACCOUNTANT => array_merge($baseCodes, [
                'payment.view_all',
                'payment.manage',
                'payment.allocate',
                'payment.refund.create',
                'cost.view',
                'cost.view_all',
                'cost.approve',
                'cost.approve_all',
            ]),
        ];

        $leaderGlobalPermissionIds = collect([
            'lead.update_all', 'lead.delete_all',
            'customer.update_all', 'customer.delete_all',
            'quotation.update_all', 'quotation.delete_all',
        ])->map(fn (string $code) => $permissionIds[$code] ?? null)->filter()->values();

        if ($leaderGlobalPermissionIds->isNotEmpty()) {
            DB::table('role_permissions')
                ->where('role_id', $roleIds[User::ROLE_LEADER])
                ->whereIn('permission_id', $leaderGlobalPermissionIds)
                ->delete();
        }

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
            $record = User::query()
                ->withTrashed()
                ->where('code', $user['code'])
                ->orWhere('email', $user['email'])
                ->first();

            $payload = [
                'code' => $user['code'],
                'name' => $user['name'],
                'email' => $user['email'],
                'password' => Hash::make($user['password']),
                'role' => $user['role'],
                'role_id' => $roleIds[$user['role']],
                'is_active' => true,
                'deleted_at' => null,
            ];

            if ($record) {
                $record->forceFill($payload)->save();

                continue;
            }

            User::query()->create($payload);
        }
    }
}
