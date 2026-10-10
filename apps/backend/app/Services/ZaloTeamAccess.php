<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Account ACL. Never equate a shared user with the account's managing team. */
class ZaloTeamAccess
{
    public static function storageOwner(): string
    {
        $owner = (string) config('zalo_team.storage_owner');
        abort_unless(preg_match('/^[a-f0-9]{64}$/D', $owner), 503, 'Chưa cấu hình phạm vi kho Zalo.');
        return $owner;
    }

    public function projection(User $user): array
    {
        abort_unless($user->is_active && ! $user->deleted_at, 401);
        $admin = $user->isAdmin();
        // accessibleDepartmentIds also includes the employee's own department;
        // only actual leadership may confer account management.
        $teams = $user->ledDepartments()->whereNull('deleted_at')->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all();
        $grants = DB::table('zt_access_grants')->where('user_id', $user->id)->get()->keyBy('account_id');
        $accounts = [];
        $departments = \App\Models\Department::pluck('name', 'id');
        $activeTeams = $departments->keys()->map(fn ($id) => (int) $id)->all();
        foreach (DB::table('zt_access_accounts')->orderBy('account_id')->get() as $a) {
            $managed = $admin || ($a->department_id && in_array((int) $a->department_id, $teams, true));
            $grant = $grants->get($a->account_id);
            $assigned = $grant && $grant->department_at_grant == $user->department_id;
            // Unassigned accounts are admin-only, including stale grants.
            if (! $admin && (! in_array((int) $a->department_id, $activeTeams, true) || (! $managed && ! $assigned))) continue;
            $accounts[(string) $a->account_id] = [
                'read' => true, 'write' => $managed || $grant?->level === 'operate',
                'manage' => (bool) $managed, 'sync' => $managed || (bool) $grant?->can_sync,
                'link' => $managed || (bool) $grant?->can_link,
                'departmentId' => $a->department_id, 'primaryUserId' => $a->primary_user_id,
                'departmentName' => $departments->get($a->department_id),
            ];
        }
        return ['admin' => $admin, 'owner' => self::storageOwner(), 'userId' => (int) $user->id,
            'userName' => (string) $user->name,
            'teams' => $teams, 'accounts' => (object) $accounts,
            'canLink' => $admin || count($teams) > 0,
            'loginIds' => DB::table('zt_access_logins')->where('user_id', $user->id)->where('expires_at', '>', now())->pluck('id')->all()];
    }

    public static function scope(User $user): array
    {
        if ($user instanceof \App\Models\ZaloTeamIdentityUser) {
            $scope = $user->getAttribute('zalo_access');
            abort_unless(is_array($scope), 403, 'Chưa xác nhận được quyền Zalo.');
            return $scope;
        }
        return app(self::class)->projection($user);
    }

    public static function ids(User $user, string $ability = 'read'): ?array
    {
        $scope = self::scope($user);
        if ($scope['admin'] ?? false) return null;
        return array_map('intval', array_keys(array_filter((array) ($scope['accounts'] ?? []), fn ($a) => ! empty($a[$ability]))));
    }

    public static function allow(User $user, int $account, string $ability = 'read'): void
    {
        $ids = self::ids($user, $ability);
        abort_unless($ids === null || in_array($account, $ids, true), 403, 'Bạn không có quyền thao tác với tài khoản Zalo này.');
    }

    public static function admin(User $user): void
    {
        abort_unless(self::scope($user)['admin'] ?? false, 403, 'Chức năng này dành cho quản trị viên.');
    }

    public static function sources($query, User $user, string $column = 'account_id')
    {
        $ids = self::ids($user);
        return $ids === null ? $query : $query->whereIn($column, $ids);
    }

    public static function messages(User $user)
    {
        return DB::table('zt_archive_observations')->where('deleted', false)->whereIn('source_id',
            self::sources(DB::table('zt_archive_sources')->where('owner', self::storageOwner()), $user)->select('id'))->select('message_id');
    }

    /** Correlated visibility avoids materializing every visible message ID for a read. */
    public static function whereVisibleMessage($query, User $user, string $column, ?int $account = null)
    {
        return $query->whereExists(function ($q) use ($user, $column, $account) {
            $q->selectRaw('1')->from('zt_archive_observations as visible_o')
                ->join('zt_archive_sources as visible_s', 'visible_s.id', '=', 'visible_o.source_id')
                ->whereColumn('visible_o.message_id', $column)->where('visible_o.deleted', false)
                ->where('visible_s.owner', self::storageOwner());
            self::sources($q, $user, 'visible_s.account_id');
            if ($account !== null) $q->where('visible_s.account_id', $account);
        });
    }

    public static function audit(User $user, string $action, ?int $account = null, array $detail = []): void
    {
        // Remote Zalo operations have a separate bounded service audit log.
        if (ZaloTeamRuntime::role() === 'zalo') {
            \Illuminate\Support\Facades\Log::info('zalo.access', ['actor' => $user->id, 'account' => $account, 'action' => $action]);
            return;
        }
        DB::table('zt_access_audit')->insert(['user_id' => $user->id, 'account_id' => $account, 'action' => $action,
            'detail' => json_encode($detail), 'created_at' => now()]);
    }

    public static function revokeUser(int $id): void
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('zt_access_grants')) return;
        DB::transaction(function () use ($id) {
            $affected = DB::table('zt_access_grants')->where('user_id', $id)->pluck('account_id');
            DB::table('zt_access_accounts')->where(fn ($q) => $q->whereIn('account_id', $affected)->orWhere('primary_user_id', $id))
                ->update(['revision' => DB::raw('revision + 1'), 'updated_at' => now()]);
            DB::table('zt_access_accounts')->where('primary_user_id', $id)->update(['primary_user_id' => null]);
            DB::table('zt_access_grants')->where('user_id', $id)->delete();
            DB::table('zt_access_logins')->where('user_id', $id)->delete();
            DB::table('zt_access_audit')->insert(['user_id' => auth()->id(), 'account_id' => null,
                'action' => 'access.user-revoked', 'detail' => json_encode(['userId' => $id, 'accounts' => $affected]), 'created_at' => now()]);
        });
    }
}
