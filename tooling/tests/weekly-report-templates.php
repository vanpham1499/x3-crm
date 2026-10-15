<?php

use App\Http\Controllers\WeeklyReportTemplatesController;
use App\Http\Middleware\EnsurePermission;
use App\Models\User;
use App\Models\WeeklyReportTemplate;
use Database\Seeders\WeeklyReportTemplateSeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
DB::purge('sqlite');
Schema::create('users', function ($t) {
    $t->id();
});
Schema::create('roles', function ($t) {
    $t->id();
    $t->string('name');
    $t->softDeletes();
});
Schema::create('permissions', function ($t) {
    $t->id();
    $t->string('code');
    $t->string('module');
    $t->string('name');
    $t->string('description');
    $t->timestamps();
    $t->softDeletes();
});
Schema::create('role_permissions', function ($t) {
    $t->unsignedBigInteger('role_id');
    $t->unsignedBigInteger('permission_id');
    $t->unsignedBigInteger('deleted_by')->nullable();
    $t->timestamps();
    $t->softDeletes();
});
Schema::create('services', function ($t) {
    $t->id();
    $t->integer('parent_id')->nullable();
    $t->string('code');
    $t->string('name');
    $t->boolean('is_active')->default(true);
    $t->integer('sort_order')->default(0);
    $t->softDeletes();
});
DB::table('users')->insert(['id' => 1]);
DB::table('roles')->insert([['id' => 1, 'name' => 'ADMIN'], ['id' => 2, 'name' => 'LEADER']]);
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_13_000300_create_weekly_report_templates.php')->up();
$checks = 0;
function verifyTemplate(bool $condition, string $name): void
{
    global $checks;
    if (! $condition) {
        throw new RuntimeException($name);
    } $checks++;
}
function templateRequest(array $data, bool $admin = true): Request
{
    $request = Request::create('/', 'POST', $data);
    $user = new class extends User
    {
        public bool $manage = false;

        public function hasPermission(string $code): bool
        {
            return $code === 'weeklyreport.view' || ($this->manage && $code === 'weeklytemplate.manage');
        }
    };
    $user->id = 1;
    $user->manage = $admin;
    $request->setUserResolver(fn () => $user);

    return $request;
}
function expectTemplateFailure(callable $callback, int $code): void
{
    try {
        $callback();
        throw new RuntimeException('Expected failure '.$code);
    } catch (ValidationException $e) {
        verifyTemplate($code === 422, 'Validation failed as expected');
    } catch (HttpException $e) {
        verifyTemplate($e->getStatusCode() === $code, 'HTTP failure '.$code);
    }
}
$controller = new WeeklyReportTemplatesController;
verifyTemplate(DB::table('role_permissions')->count() === 1 && DB::table('role_permissions')->value('role_id') === 1, 'Only admin initially granted');
$seed = new WeeklyReportTemplateSeeder;
$seed->run();
$seed->run();
verifyTemplate(WeeklyReportTemplate::count() === 25, 'Seed is idempotent');
$first = WeeklyReportTemplate::first();
$first->update(['content' => 'Admin edited']);
$seed->run();
verifyTemplate($first->fresh()->content === 'Admin edited', 'Seed preserves admin edits');
DB::table('services')->insert([['id' => 1, 'parent_id' => null, 'code' => 'GOOGLE', 'name' => 'Google'], ['id' => 2, 'parent_id' => 1, 'code' => 'SEARCH', 'name' => 'Search'], ['id' => 3, 'parent_id' => null, 'code' => 'OTHER', 'name' => 'Other']]);
$payload = ['title' => 'Local fixture', 'service_id' => 1, 'category' => 'Fixture', 'usage_hint' => 'Internal only', 'content' => 'Customer text', 'is_active' => true, 'sort_order' => 0];
$row = $controller->store(templateRequest($payload))->getData(true);
verifyTemplate($row['content'] === 'Customer text' && $row['version'] === 1, 'Create persists template');
$other = $controller->store(templateRequest([...$payload, 'service_id' => 3]))->getData(true);
$result = $controller->index(templateRequest(['service_id' => 2, 'category' => 'Fixture'], false))->getData(true);
verifyTemplate(count($result['items']) === 1 && $result['items'][0]['id'] === $row['id'], 'Child service inherits parent templates');
$result = $controller->index(templateRequest(['service_id' => 2], false))->getData(true);
verifyTemplate($result['total'] === 26 && count($result['items']) === 20, 'Shared plus parent and bounded pagination');
$changed = $controller->update(templateRequest([...$payload, 'version' => 1, 'is_active' => false]), $row['id'])->getData(true);
verifyTemplate($changed['version'] === 2 && ! $changed['is_active'], 'Toggle versioned');
expectTemplateFailure(fn () => $controller->update(templateRequest([...$payload, 'version' => 1]), $row['id']), 409);
verifyTemplate($controller->index(templateRequest(['category' => 'Fixture'], false))->getData(true)['total'] === 1, 'Disabled hidden from readers');
verifyTemplate($controller->index(templateRequest(['category' => 'Fixture', 'manage' => 1]))->getData(true)['total'] === 2, 'Managers see disabled');
expectTemplateFailure(fn () => $controller->index(templateRequest(['manage' => 1], false)), 403);
expectTemplateFailure(fn () => $controller->selection(templateRequest(['ids' => [$row['id']]], false)), 422);
expectTemplateFailure(fn () => $controller->selection(templateRequest(['ids' => [$other['id'], $other['id']]], false)), 422);
verifyTemplate($controller->selection(templateRequest(['ids' => [$other['id'], $first->id]], false))->getData(true)[0]['id'] === $other['id'], 'Selection order preserved');
expectTemplateFailure(fn () => $controller->store(templateRequest([...$payload, 'title' => ''])), 422);
expectTemplateFailure(fn () => $controller->store(templateRequest([...$payload, 'service_id' => 99999])), 422);
expectTemplateFailure(fn () => $controller->store(templateRequest([...$payload, 'sort_order' => -1])), 422);
expectTemplateFailure(fn () => $controller->store(templateRequest([...$payload, 'content' => str_repeat('a', 10001)])), 422);
$middleware = new EnsurePermission;
verifyTemplate($middleware->handle(templateRequest([], false), fn () => response('ok'), 'weeklytemplate.manage')->getStatusCode() === 403, 'Non-manager write denied by middleware');
verifyTemplate($middleware->handle(templateRequest([]), fn () => response('ok'), 'weeklytemplate.manage')->getStatusCode() === 200, 'Manager write allowed');
foreach (app('router')->getRoutes() as $route) {
    if (in_array($route->uri(), ['api/weekly-report-templates', 'api/weekly-report-templates/{id}']) && array_intersect($route->methods(), ['PUT', 'POST'])) {
        verifyTemplate(in_array('permission:weeklytemplate.manage',$route->gatherMiddleware(),true),'Write route protected');
    }
}
echo "$checks template checks passed (SQLite memory)\n";
