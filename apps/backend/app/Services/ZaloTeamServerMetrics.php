<?php

namespace App\Services;

use App\Models\User;
use App\Models\ZaloTeamIdentityUser;

class ZaloTeamServerMetrics
{
    public static function allowed(User $user): bool
    {
        return $user instanceof ZaloTeamIdentityUser
            ? $user->getAttribute('can_monitor_server') === true
            : $user->isAdmin();
    }

    public function read(User $user): array
    {
        abort_unless(self::allowed($user), 403, 'Chỉ quản trị viên được xem tài nguyên server.');
        $path = config('zalo_team.metrics_path');
        // The web process only reads a bounded snapshot; it never runs Docker/SSH.
        $raw = is_string($path) && is_file($path) ? file_get_contents($path, false, null, 0, 1048577) : false;
        $data = is_string($raw) && strlen($raw) <= 1048576 ? json_decode($raw, true) : null;
        abort_unless(is_array($data) && ($data['version'] ?? null) === 1
            && is_numeric($data['sampledAt'] ?? null) && is_array($data['host'] ?? null), 503,
            'Chưa có số liệu server. Kiểm tra dịch vụ giám sát trên VPS rồi tải lại.');
        $data['stale'] = time() - $data['sampledAt'] > 90 || $data['sampledAt'] > time() + 30;

        return array_intersect_key($data, array_flip(['sampledAt', 'host', 'services', 'storage', 'history', 'stale', 'servicesAvailable']))
            + ['drive' => app(ZaloTeamDriveStore::class)->status(ZaloTeamArchive::owner($user))];
    }
}
