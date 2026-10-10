<?php

namespace App\Services;

/** Short-lived priority over background archive scans, scoped to one owner. */
class ZaloTeamFileImportLease
{
    private static function path(string $owner): string
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $owner)) {
            throw new \InvalidArgumentException('Invalid owner');
        }

        return config('zalo_team.archive_path').'/locks/'.$owner.'.file-import';
    }

    public static function touch(string $owner): void
    {
        $path = self::path($owner);
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0700, true);
        }
        touch($path);
    }

    public static function active(string $owner): bool
    {
        $path = self::path($owner);
        clearstatcache(true, $path);

        return is_file($path) && filemtime($path) > time() - 120;
    }
}
