<?php

namespace App\Services;

use App\Models\User;
use App\Models\ZaloTeamIdentityUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ZaloTeamIdentity
{
    public static function projection(User $user): array
    {
        return ['id' => (int) $user->id, 'tenant_id' => $user->tenant_id,
            'company_id' => $user->company_id, 'is_active' => (bool) $user->is_active,
            'can_monitor_server' => $user->isAdmin(),
            'zalo_access' => app(ZaloTeamAccess::class)->projection($user),
            'zalo_permissions' => array_values(array_filter(['zalo_team.tags.manage', 'zalo_team.campaigns.send'], fn ($code) => $user->hasPermission($code)))];
    }

    public function worker(int $id): User
    {
        ZaloTeamRuntime::requireWorker();
        if (ZaloTeamRuntime::role() !== 'zalo') {
            return User::where('is_active', true)->findOrFail($id);
        }

        // A scheduled workspace job must not depend on the employee who first enabled it.
        // This principal is created only in the private CLI worker, never for HTTP sessions.
        abort_unless(app()->runningInConsole(), 403);
        abort_unless(DB::table('users')->where('id', $id)->exists(), 404);
        $user = new ZaloTeamIdentityUser;
        $user->forceFill(['id' => $id, 'is_active' => true, 'zalo_access' => ['admin' => true,
            'owner' => ZaloTeamAccess::storageOwner(), 'accounts' => [], 'teams' => [], 'loginIds' => []]]);
        return $user;
    }

    public function session(Request $request): User
    {
        return $this->remote('/auth/zalo-team', [
            'Cookie' => (string) $request->header('Cookie'),
            // Fixed public origin: never let callers choose the auth trust boundary.
            'Origin' => config('zalo_team.public_origin'),
            'Referer' => rtrim(config('zalo_team.public_origin'), '/').'/',
        ]);
    }

    public function bridgeActor(int $id): User
    {
        $user = $this->remote('/internal/zalo-team/identity/'.$id, [], $id);
        ZaloTeamAccess::admin($user);
        return $user;
    }

    /** A send worker always uses a fresh real CRM actor, never the backup principal. */
    public function campaignActor(int $id): User
    {
        abort_unless(ZaloTeamRuntime::role() === 'zalo' && app()->runningInConsole(), 403);
        return $this->remote('/internal/zalo-team/identity/'.$id, [], $id);
    }

    private function remote(string $path, array $headers, ?int $expectedId = null): User
    {
        $base = rtrim((string) config('zalo_team.crm_api_url'), '/');
        abort_unless(preg_match('#^https?://#', $base), 503, 'CRM identity endpoint is not configured.');
        $response = Http::acceptJson()->withOptions(['allow_redirects' => false])->connectTimeout(3)->timeout(8)
            ->withHeaders($headers + ['X-Zalo-Service-Key' => ZaloTeamRuntime::key()])->get($base.$path);
        abort_unless($response->successful(), in_array($response->status(), [401, 403, 404]) ? 401 : 503, 'Chưa xác nhận được quyền truy cập từ CRM.');
        $data = $response->json();
        abort_unless(is_array($data) && is_int($data['id'] ?? null) && $data['id'] > 0 && ($data['is_active'] ?? false) === true, 401);
        abort_if($expectedId !== null && $expectedId !== $data['id'], 403);
        $user = new ZaloTeamIdentityUser;
        $user->forceFill(array_intersect_key($data, array_flip(['id', 'tenant_id', 'company_id', 'is_active', 'zalo_permissions', 'can_monitor_server', 'zalo_access'])));
        // Identity FK keeps its original per-user hash; shared storage is separate.
        $owner = hash('sha256', 'zalo-team:'.($user->tenant_id ?: $user->company_id ?: 'local').':'.$user->id);
        // Preserve FKs without copying CRM credentials or business tables.
        DB::table('users')->insertOrIgnore(['id' => $user->id, 'zalo_owner' => $owner]);
        abort_unless(DB::table('users')->where('id', $user->id)->value('zalo_owner') === $owner, 403, 'CRM identity scope changed; migration is required.');

        return $user;
    }
}
