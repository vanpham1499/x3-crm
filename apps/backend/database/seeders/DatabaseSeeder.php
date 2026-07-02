<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
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
                    'is_active' => true,
                ],
            );
        }
    }
}
