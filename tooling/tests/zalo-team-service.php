<?php
putenv('ZALO_TEAM_REMOTE_API_URL=');
putenv('ZALO_TEAM_MAINTENANCE=false');
// No network, real DB, profiles or archive mutation. Each invocation has an isolated SQLite DB.
$role = $argv[1] ?? 'zalo';
putenv('ZALO_TEAM_RUNTIME='.$role);
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use App\Services\ZaloTeamIdentity;
use App\Services\ZaloTeamRuntime;
use App\Services\ZaloTeamArchive;

set_exception_handler(function (Throwable $e) { fwrite(STDERR, 'FAIL: '.$e->getMessage()."\n"); exit(1); });
function fakeIdentity($data, $status = 200) { Http::swap(new Illuminate\Http\Client\Factory); Http::preventStrayRequests(); Http::fake(['crm.test/*' => Http::response($data, $status)]); }
$checks = 0;
function check($v, $message) { global $checks; if (! $v) { throw new RuntimeException($message); } $checks++; }
function denies($fn, int $status) {
    try { $fn(); } catch (Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e) { check($e->getStatusCode() === $status, 'expected rejection status'); return; }
    throw new RuntimeException('expected rejection');
}
config(['database.default' => 'isolated', 'database.connections.isolated' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]]);
DB::purge('isolated');
$routes = collect(app('router')->getRoutes())->map(fn ($r) => $r->uri());
check(ZaloTeamRuntime::role() === $role, 'runtime loaded');
if ($role === 'crm') {
    check(! $routes->contains('api/zalo-team/archive'), 'CRM does not expose archive');
    check($routes->contains('api/auth/zalo-team'), 'CRM owns auth');
    try { ZaloTeamRuntime::requireWorker(); throw new LogicException('worker allowed'); } catch (RuntimeException $e) { check(str_contains($e->getMessage(), 'disabled'), 'CRM worker blocked'); }
    try { Artisan::call('zalo-team:archive'); throw new LogicException('CLI allowed'); } catch (RuntimeException $e) { check(str_contains($e->getMessage(), 'Zalo commands'), 'CLI Zalo disabled'); }
} elseif ($role === 'combined') {
    check($routes->contains('api/zalo-team/archive') && $routes->contains('api/auth/me'), 'local compatibility');
    check(Artisan::call('zalo-team:migrate') !== 0, 'dedicated migration refused on combined');
} else {
    check($routes->contains('api/zalo-team/archive') && ! $routes->contains('api/customers'), 'dedicated route boundary');
    check(Artisan::call('zalo-team:migrate') === 0, 'dedicated migrations');
    check(Schema::hasTable('zt_archive_assets') && Schema::hasColumn('zt_archive_pc_recoveries', 'source_state'), 'all Zalo migrations included');
    check(! Schema::hasTable('customers') && ! Schema::hasTable('roles') && ! Schema::hasColumn('users', 'password'), 'no CRM business or credentials copied');
    check(Artisan::call('zalo-team:migrate') === 0, 'migration replay safe');
    $secret = tempnam(sys_get_temp_dir(), 'zt-key-');
    file_put_contents($secret, str_repeat('a', 64));
    config(['zalo_team.service_key_file' => $secret, 'zalo_team.crm_api_url' => 'https://crm.test/api', 'zalo_team.public_origin' => 'https://crm.example']);
    try {
        $request = Illuminate\Http\Request::create('/api/zalo-team/archive', 'POST');
        denies(fn () => ZaloTeamRuntime::authenticateService($request), 403);
        $request->headers->set('X-Zalo-Service-Key', str_repeat('a', 64));
        ZaloTeamRuntime::authenticateService($request);
        Http::preventStrayRequests();
        $identity = ['id' => 7, 'tenant_id' => 12, 'company_id' => null, 'is_active' => true, 'zalo_permissions' => ['zalo_team.tags.manage']];
        fakeIdentity($identity);
        $request->headers->set('Cookie', 'test-session=fixture');
        $user = app(ZaloTeamIdentity::class)->session($request);
        check($user->hasPermission('zalo_team.tags.manage') && ! $user->hasPermission('user.manage'), 'permissions stay scoped');
        check(ZaloTeamArchive::owner($user) === hash('sha256', 'zalo-team:12:7'), 'owner consistent across services');
        check(DB::table('users')->count() === 1, 'minimal FK projection created');
        $kernel = app(Illuminate\Contracts\Http\Kernel::class);
        $probe = Illuminate\Http\Request::create('/api/zalo-team/archive/assets/not-present', 'GET');
        $probe->headers->set('Accept', 'application/json');
        check($kernel->handle($probe)->getStatusCode() === 403, 'HTTP API denies missing service key');
        $probe = Illuminate\Http\Request::create('/api/zalo-team/archive/assets/not-present', 'GET');
        $probe->headers->set('Accept', 'application/json');
        $probe->headers->set('X-Zalo-Service-Key', str_repeat('a', 64));
        check($kernel->handle($probe)->getStatusCode() === 404, 'authenticated HTTP reaches isolated asset lookup');
        $probe = Illuminate\Http\Request::create('/broadcasting/auth', 'POST');
        $probe->headers->set('Accept', 'application/json');
        check($kernel->handle($probe)->getStatusCode() === 404, 'CRM broadcasting absent from isolated service');
        check(Http::recorded(fn ($r) => $r->url() === 'https://crm.test/api/auth/zalo-team' && $r->hasHeader('Cookie', 'test-session=fixture') && $r->hasHeader('Origin', 'https://crm.example'))->count() > 0, 'identity request boundary');
        $worker = app(ZaloTeamIdentity::class)->worker(7);
        check(ZaloTeamArchive::owner($worker) === ZaloTeamArchive::owner($user), 'worker same owner');
        check(Http::recorded(fn ($r) => str_contains($r->url(), '/internal/zalo-team/identity/7') && ! $r->hasHeader('Cookie'))->count() > 0, 'identity request boundary');
        fakeIdentity($identity, 401);
        denies(fn () => app(ZaloTeamIdentity::class)->worker(7), 401);
        fakeIdentity(array_replace($identity, ['tenant_id' => 99]));
        denies(fn () => app(ZaloTeamIdentity::class)->worker(7), 403);
        fakeIdentity(array_replace($identity, ['id' => 8]));
        denies(fn () => app(ZaloTeamIdentity::class)->worker(7), 403);
        fakeIdentity(array_replace($identity, ['is_active' => false]));
        denies(fn () => app(ZaloTeamIdentity::class)->worker(7), 401);
        fakeIdentity([], 503);
        denies(fn () => app(ZaloTeamIdentity::class)->session($request), 503);
    } finally { unlink($secret); }
}
echo "$checks service checks passed ($role)\n";
