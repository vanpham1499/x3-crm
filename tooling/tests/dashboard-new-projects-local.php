<?php

require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $e): void { fwrite(STDERR, (string) $e); exit(1); });
if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.host') !== '127.0.0.1'
    || (string) config('database.connections.pgsql.port') !== '5433') {
    throw new RuntimeException('Local DB 127.0.0.1:5433 only');
}

use App\Models\{Project, User};
use App\Services\DashboardService;
use Carbon\CarbonImmutable as Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

$checks = 0;
function expectNewProjects(mixed $actual, mixed $expected, string $label): void {
    global $checks;
    if ($actual !== $expected) throw new RuntimeException($label.': '.json_encode([$actual, $expected]));
    $checks++;
}

DB::beginTransaction();
try {
    $admin = User::where('role', 'ADMIN')->firstOrFail();
    $base = Project::firstOrFail();
    $service = app(DashboardService::class);
    $reportMethod = new ReflectionMethod($service, 'projectReport');
    $countMethod = new ReflectionMethod($service, 'newProjectCount');
    $report = fn ($from, $to) => $reportMethod->invoke($service, Date::parse($from.'-01'), Date::parse($to.'-01'), $admin, []);
    $total = fn ($data) => array_sum(array_column($data['periods'], 'total'));
    $baseline = $report('2094-01', '2094-03');
    $create = function (string $created, ?string $started, ?int $manager) use ($base): Project {
        $project = $base->replicate();
        $project->project_code = 'NEW-PROJECT-ROLLBACK-'.Str::random(10);
        $project->quotation_id = null;
        $project->manager_user_id = $manager;
        $project->created_at = $created;
        $project->updated_at = $created;
        $project->start_date = $started;
        $project->saveQuietly();
        return $project;
    };
    $january = $create('2094-01-01 00:00:00', '2093-12-01', $admin->id);
    $create('2094-02-28 23:59:59', '2094-03-01', $admin->id);
    $create('2094-03-31 23:59:59', null, null);
    $create('2093-12-31 23:59:59', '2094-01-01', $admin->id);
    $create('2094-04-01 00:00:00', '2094-03-01', $admin->id);
    $deleted = $create('2094-02-01 00:00:00', null, $admin->id);
    $deleted->deleted_at = '2094-02-02'; $deleted->saveQuietly();

    $data = $report('2094-01', '2094-03');
    expectNewProjects($total($data) - $total($baseline), 3, 'Creation date wins over start date and excludes deleted/outside range');
    foreach ([0, 1, 2] as $index) {
        expectNewProjects($data['periods'][$index]['total'] - $baseline['periods'][$index]['total'], 1, 'One new project per calendar month '.$index);
    }
    expectNewProjects(array_sum(array_column($data['employees'], 'total')), $total($data), 'Employee counts equal monthly counts');
    expectNewProjects($countMethod->invoke($service, Date::parse('2094-01-01'), Date::parse('2094-04-01'), $admin), $total($data), 'Summary equals team report for same all-project scope');
    $unassigned = collect($data['employees'])->firstWhere('id', 0);
    expectNewProjects($unassigned['name'], 'Chưa phân công', 'Unassigned project retains its own group');
    $month = $report('2094-02', '2094-02');
    expectNewProjects($total($month), $data['periods'][1]['total'], 'Month and quarter agree');
    $january->start_date = '2094-03-20'; $january->updated_at = '2094-03-20'; $january->saveQuietly();
    expectNewProjects($report('2094-01', '2094-03')['periods'], $data['periods'], 'Editing or restarting a project cannot move its creation month');
    $january->manager_user_id = null; $january->saveQuietly();
    $reassigned = $report('2094-01', '2094-03');
    expectNewProjects($reassigned['periods'], $data['periods'], 'Reassignment does not double count');
    expectNewProjects(collect($reassigned['employees'])->firstWhere('id', 0)['total'], $unassigned['total'] + 1, 'Uses current assigned manager');
    echo "$checks new project report checks passed; fixtures rolled back\n";
} finally {
    DB::rollBack();
}
