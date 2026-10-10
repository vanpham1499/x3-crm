<?php

namespace App\Services;

use Illuminate\Http\Request;

final class ZaloTeamRuntime
{
    public static function migrationPaths(): array
    {
        $paths = [database_path('zalo-service')];
        foreach (['*_zalo_team_*.php', '*_zalo_archive_*.php', '*_zalo_phone_sync_*.php', '*_pc_recovery_*.php'] as $pattern) {
            foreach (glob(database_path('migrations/'.$pattern)) as $file) {
                $paths[] = $file;
            }
        }
        return array_values(array_unique($paths));
    }

    public static function role(): string
    {
        $role = config('zalo_team.runtime', 'combined');
        if (! in_array($role, ['combined', 'crm', 'zalo'], true)) {
            throw new \RuntimeException('Invalid ZALO_TEAM_RUNTIME');
        }

        return $role;
    }

    public static function requireWorker(): void
    {
        if (self::role() === 'crm') {
            throw new \RuntimeException('Zalo jobs are disabled on the CRM server');
        }
    }

    public static function key(): string
    {
        $path = config('zalo_team.service_key_file');
        $key = $path && is_readable($path) ? trim(file_get_contents($path)) : '';
        abort_unless(preg_match('/^[a-f0-9]{64}$/D', $key), 503, 'Zalo service key is not configured.');

        return $key;
    }

    public static function authenticateService(Request $request): void
    {
        abort_unless(hash_equals(self::key(), (string) $request->header('X-Zalo-Service-Key')), 403);
    }
}
