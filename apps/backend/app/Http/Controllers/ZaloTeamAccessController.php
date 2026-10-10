<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\User;
use App\Services\ZaloTeamAccess;
use App\Services\ZaloTeamCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ZaloTeamAccessController extends Controller
{
    public function command(Request $request, ZaloTeamAccess $access, ZaloTeamCatalog $catalog)
    {
        $v = $request->validate([
            'kind' => 'required|in:scope,read,save,login,finish-login,audit',
            'accountId' => 'sometimes|integer|min:1', 'revision' => 'required_if:kind,save|integer|min:0',
            'departmentId' => 'nullable|integer|min:1', 'primaryUserId' => 'nullable|integer|min:1',
            'grants' => 'present_if:kind,save|array|max:500', 'grants.*.userId' => 'required|integer|min:1|distinct',
            'grants.*.level' => 'required|in:read,operate', 'grants.*.canSync' => 'required|boolean',
            'grants.*.canLink' => 'required|boolean', 'action' => 'sometimes|string|max:80', 'loginId' => 'sometimes|uuid',
            'requestId' => 'sometimes|uuid',
        ]);
        $user = $request->user();
        $scope = $access->projection($user);
        if ($v['kind'] === 'scope') return response()->json(['access' => $scope]);
        if ($v['kind'] === 'audit') {
            if (! empty($v['accountId'])) ZaloTeamAccess::allow($user, $v['accountId'], 'write');
            ZaloTeamAccess::audit($user, 'web.'.($v['action'] ?? 'operation'), $v['accountId'] ?? null,
                array_intersect_key($v, array_flip(['requestId'])));
            return response()->json(['ok' => true]);
        }
        if ($v['kind'] === 'login') {
            abort_unless(in_array($v['action'] ?? '', ['begin','retry','cancel']), 422);
            if ($v['action'] === 'begin') {
                if (! empty($v['accountId'])) {
                    ZaloTeamAccess::allow($user, $v['accountId'], 'link');
                    $team = DB::table('zt_access_accounts')->where('account_id', $v['accountId'])->value('department_id');
                } else {
                    abort_unless($scope['canLink'], 403);
                    $team = $v['departmentId'] ?? null;
                    if (! $scope['admin']) abort_unless(in_array($team, $scope['teams'], true), 403, 'Chọn team do bạn quản lý.');
                    if ($team) Department::findOrFail($team);
                }
                $result = $catalog->rawCommand($user, ['action' => 'begin'] + (isset($v['accountId']) ? ['accountId' => $v['accountId']] : []));
                if ($login = $result['login'] ?? null) {
                    DB::table('zt_access_logins')->updateOrInsert(['id' => $login['id']], ['user_id' => $user->id,
                        'account_id' => $login['accountId'], 'department_id' => $team, 'expires_at' => now()->addMinutes(10)]);
                }
            } else {
                $pending = DB::table('zt_access_logins')->where('id', $v['loginId'] ?? '')->where('user_id', $user->id)->where('expires_at', '>', now())->first();
                abort_unless($pending, 403, 'Phiên liên kết không thuộc người dùng này.');
                $this->pendingAllowed($scope, $pending);
                $result = $catalog->rawCommand($user, ['action' => $v['action'], 'loginId' => $pending->id]);
                if ($v['action'] === 'retry' && ($login = $result['login'] ?? null)) {
                    DB::table('zt_access_logins')->insertOrIgnore(['id' => $login['id'], 'user_id' => $user->id,
                        'account_id' => $login['accountId'], 'department_id' => $pending->department_id, 'expires_at' => now()->addMinutes(10)]);
                }
                if ($v['action'] === 'cancel') DB::table('zt_access_logins')->where('id', $pending->id)->delete();
            }
            ZaloTeamAccess::audit($user, 'login.'.$v['action'], $result['login']['accountId'] ?? null);
            // Never return the unfiltered connector snapshot to the browser.
            return response()->json(['ok' => true]);
        }
        if ($v['kind'] === 'finish-login') {
            $pending = DB::table('zt_access_logins')->where('id', $v['loginId'] ?? '')->where('user_id', $user->id)->where('expires_at', '>', now())->first();
            abort_unless($pending, 403);
            $this->pendingAllowed($scope, $pending);
            $status = $catalog->rawCommand($user, ['action' => 'status']);
            abort_unless(($status['login']['id'] ?? '') === $pending->id && ($status['login']['state'] ?? '') === 'connected', 409);
            $a = collect($status['accounts'])->firstWhere('id', $pending->account_id);
            abort_unless($a, 409);
            $this->register($a, $pending->department_id);
            return response()->json(['ok' => true]);
        }
        if ($v['kind'] === 'save') {
            abort_unless(! empty($v['accountId']), 422);
            ZaloTeamAccess::allow($user, $v['accountId'], 'manage');
            DB::transaction(function () use ($v, $user, $scope) {
                $a = DB::table('zt_access_accounts')->where('account_id', $v['accountId'])->lockForUpdate()->first();
                abort_unless($a && (int) $a->revision === $v['revision'], 409, 'Phân quyền đã thay đổi. Tải lại trước khi lưu.');
                $team = $v['departmentId'] ?? null;
                if (! $scope['admin']) abort_unless((int) $a->department_id === $team, 403, 'Chỉ admin được chuyển team.');
                if ($team) Department::findOrFail($team);
                abort_if(! $team && (! empty($v['grants']) || ! empty($v['primaryUserId'])), 422, 'Chọn team trước khi giao tài khoản.');
                $primary = isset($v['primaryUserId']) ? User::where('is_active', true)->findOrFail($v['primaryUserId']) : null;
                abort_if($primary && (int) $primary->department_id !== $team, 422, 'Người phụ trách phải thuộc team quản lý.');
                $people = User::where('is_active', true)->whereIn('id', array_column($v['grants'], 'userId'))->get()->keyBy('id');
                abort_unless($people->count() === count($v['grants']), 422, 'Có nhân viên không còn hoạt động.');
                if (! $scope['admin']) foreach ($people as $person) abort_unless((int) $person->department_id === (int) $a->department_id, 403);
                $old = DB::table('zt_access_grants')->where('account_id', $a->account_id);
                // A leader cannot revoke a cross-team grant made by an admin.
                if (! $scope['admin']) $old->whereIn('user_id', User::where('department_id', $a->department_id)->select('id'));
                $old->delete();
                foreach ($v['grants'] as $g) {
                    abort_if($g['level'] === 'read' && ($g['canSync'] || $g['canLink']), 422, 'Quyền chỉ xem không được đồng bộ hoặc kết nối lại.');
                    DB::table('zt_access_grants')->updateOrInsert(['account_id' => $a->account_id, 'user_id' => $g['userId']],
                        ['department_at_grant' => $people[$g['userId']]->department_id, 'level' => $g['level'],
                            'can_sync' => $g['canSync'], 'can_link' => $g['canLink'], 'created_at' => now(), 'updated_at' => now()]);
                }
                if ($primary) abort_unless(DB::table('zt_access_grants')->where('account_id', $a->account_id)->where('user_id', $primary->id)->exists(), 422, 'Thêm người phụ trách vào danh sách sử dụng.');
                DB::table('zt_access_accounts')->where('account_id', $a->account_id)->update(['department_id' => $team, 'primary_user_id' => $primary?->id, 'revision' => $a->revision + 1, 'updated_at' => now()]);
                ZaloTeamAccess::audit($user, 'access.save', (int) $a->account_id, $v);
            });
        }
        if ($scope['admin']) {
            foreach ($catalog->rawCommand($user, ['action' => 'status'])['accounts'] ?? [] as $a) {
                // Do not race the creator's finish-login team binding.
                if (DB::table('zt_access_logins')->where('account_id', $a['id'])->whereNotNull('department_id')->where('expires_at', '>', now())->exists()
                    && ! DB::table('zt_access_accounts')->where('account_id', $a['id'])->exists()) continue;
                $this->register($a);
            }
        }
        $scope = $access->projection($user);
        $manageable = ZaloTeamAccess::ids($user, 'manage');
        $accounts = DB::table('zt_access_accounts')->when($manageable !== null, fn ($q) => $q->whereIn('account_id', $manageable))->get();
        $people = User::where('is_active', true)->when(! $scope['admin'], fn ($q) => $q->whereIn('department_id', $scope['teams']))->get(['id','name','department_id']);
        $grants = DB::table('zt_access_grants')->whereIn('account_id', $accounts->pluck('account_id'))->whereIn('user_id', $people->pluck('id'))->get();
        return response()->json(['access' => $scope, 'accounts' => $accounts, 'grants' => $grants, 'users' => $people,
            'departments' => Department::when(! $scope['admin'], fn ($q) => $q->whereIn('id', $scope['teams']))->get(['id','name'])]);
    }

    private function pendingAllowed(array $scope, object $pending): void
    {
        abort_unless($scope['admin'] || in_array((int) $pending->department_id, $scope['teams'], true)
            || ! empty(((array) $scope['accounts'])[$pending->account_id]['link']), 403);
    }

    private function register(array $a, ?int $team = null): void
    {
        if (empty($a['externalId']) || ! preg_match('/^\d{1,30}$/D', (string) $a['externalId'])) return;
        DB::table('zt_access_accounts')->insertOrIgnore(['account_id' => $a['id'], 'external_id' => $a['externalId'],
            'name' => $a['name'], 'department_id' => $team, 'revision' => 0, 'created_at' => now(), 'updated_at' => now()]);
        $match = DB::table('zt_access_accounts')->where('account_id', $a['id'])->where('external_id', $a['externalId']);
        abort_unless((clone $match)->exists(), 409, 'Danh tính tài khoản đã thay đổi.');
        $match->update(['name' => $a['name'], 'updated_at' => now()]);
    }
}
