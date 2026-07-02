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
