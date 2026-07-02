<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

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
            $id = DB::table('roles')->where('name', $name)->value('id') ?: (string) Str::uuid();

            DB::table('roles')->updateOrInsert(
                ['name' => $name],
                [
                    'id' => $id,
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
        ];

        $permissionIds = [];

        foreach ($permissions as $permission) {
            $id = DB::table('permissions')->where('code', $permission['code'])->value('id') ?: (string) Str::uuid();

            DB::table('permissions')->updateOrInsert(
                ['code' => $permission['code']],
                [
                    'id' => $id,
                    'name' => $permission['name'],
                    'module' => $permission['module'],
                    'description' => 'Quyền '.$permission['name'],
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );

            $permissionIds[$permission['code']] = DB::table('permissions')->where('code', $permission['code'])->value('id');
        }

        foreach ($permissionIds as $permissionId) {
            if (! DB::table('role_permissions')->where('role_id', $roleIds[User::ROLE_ADMIN])->where('permission_id', $permissionId)->exists()) {
                DB::table('role_permissions')->insert([
                    'id' => (string) Str::uuid(),
                    'role_id' => $roleIds[User::ROLE_ADMIN],
                    'permission_id' => $permissionId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
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
