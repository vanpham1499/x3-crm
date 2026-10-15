<?php

namespace App\Support;

use App\Models\Team;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

final class TeamScope
{
    public static function available(User $user, string $module): array
    {
        if ($user->hasPermission($module.'.view_all') || ($module === 'kpi' && $user->hasPermission('kpi.manage_all'))) {
            return Team::withTrashed()->pluck('id')->map(fn ($id) => (int) $id)->all();
        }
        if ($user->hasPermission($module.'.view_department') || ($module === 'kpi' && $user->hasPermission('kpi.manage_department'))) {
            return Team::withTrashed()->whereIn('department_id', $user->accessibleDepartmentIds())->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        return ($user->hasPermission($module.'.view_team') || ($module === 'kpi' && $user->hasPermission('kpi.manage_team')))
            ? $user->accessibleTeamIds() : [];
    }

    public static function selected(User $user, string $module): ?array
    {
        $id = request()->query('team_id');
        $available = self::available($user, $module);
        if ($id !== null && $id !== '') {
            if (! ctype_digit((string) $id) || ! in_array((int) $id, $available, true)) {
                throw new AuthorizationException('Bạn không có quyền truy cập nhóm này.');
            }

            return [(int) $id];
        }
        if ($user->hasPermission($module.'.view_all') || $user->hasPermission($module.'.view_department')
            || ($module === 'kpi' && ($user->hasPermission('kpi.manage_all') || $user->hasPermission('kpi.manage_department')))) {
            return null;
        }

        return ($user->hasPermission($module.'.view_team') || ($module === 'kpi' && $user->hasPermission('kpi.manage_team'))) ? $available : null;
    }
}
