<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class EnsureAdminUser extends Command
{
    protected $signature = 'admin:ensure
        {--email=admin@x3crm.com : Admin login email}
        {--code=NV000 : Admin employee code}
        {--name=Admin X3 : Admin display name}
        {--password-env=X3_ADMIN_PASSWORD : Environment variable containing the password}';

    protected $description = 'Create or restore the production admin account without seeding sample users';

    public function handle(): int
    {
        $email = mb_strtolower(trim((string) $this->option('email')));
        $code = trim((string) $this->option('code'));
        $name = trim((string) $this->option('name'));
        $passwordEnv = trim((string) $this->option('password-env'));
        $password = $passwordEnv !== '' ? (string) env($passwordEnv, '') : '';

        if ($password === '' && $this->input->isInteractive()) {
            $password = (string) $this->secret('Admin password');
        }

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Admin email is invalid.');

            return self::FAILURE;
        }

        if ($code === '' || $name === '') {
            $this->error('Admin code and name are required.');

            return self::FAILURE;
        }

        if (mb_strlen($password) < 12) {
            $this->error("Set {$passwordEnv} to a password with at least 12 characters.");

            return self::FAILURE;
        }

        try {
            $user = DB::transaction(function () use ($email, $code, $name, $password): User {
                $adminRole = DB::table('roles')
                    ->where('name', User::ROLE_ADMIN)
                    ->lockForUpdate()
                    ->first(['id', 'deleted_at']);

                if ($adminRole) {
                    $adminRoleId = $adminRole->id;

                    if ($adminRole->deleted_at) {
                        DB::table('roles')->where('id', $adminRoleId)->update([
                            'deleted_at' => null,
                            'deleted_by' => null,
                            'updated_at' => now(),
                        ]);
                    }
                } else {
                    $adminRoleId = DB::table('roles')->insertGetId([
                        'name' => User::ROLE_ADMIN,
                        'description' => 'Quản trị hệ thống',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                $matches = User::query()
                    ->withTrashed()
                    ->where(function ($query) use ($email, $code): void {
                        $query->where('email', $email)->orWhere('code', $code);
                    })
                    ->lockForUpdate()
                    ->get();

                if ($matches->count() > 1) {
                    throw new RuntimeException(
                        'Admin email and code belong to different user records. Resolve them manually.',
                    );
                }

                $payload = [
                    'code' => $code,
                    'name' => $name,
                    'email' => $email,
                    'password' => Hash::make($password),
                    'role' => User::ROLE_ADMIN,
                    'role_id' => $adminRoleId,
                    'is_active' => true,
                    'deleted_at' => null,
                    'deleted_by' => null,
                ];
                /** @var User $user */
                $user = $matches->first();

                if ($user) {
                    $user->forceFill($payload)->save();
                } else {
                    $user = User::query()->create($payload);
                }

                $permissionIds = DB::table('permissions')
                    ->whereNull('deleted_at')
                    ->pluck('id');
                $now = now();

                foreach ($permissionIds as $permissionId) {
                    DB::table('role_permissions')->insertOrIgnore([
                        'role_id' => $adminRoleId,
                        'permission_id' => $permissionId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                return $user;
            });
        } catch (\Throwable $exception) {
            report($exception);
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Admin account is ready: {$user->email} ({$user->code})");

        return self::SUCCESS;
    }
}
