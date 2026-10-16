<?php

use App\Http\Controllers\KpiController;
use App\Models\Quotation;
use App\Models\User;
use App\Repositories\KpiReportRepository;
use App\Services\DashboardService;
use App\Services\KpiService;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Console\Kernel;

// Read-only audit; refuses every database except the known local PostgreSQL endpoint.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $error): void {
    fwrite(STDERR, $error->getMessage().PHP_EOL);
    exit(1);
});
if (config('database.connections.pgsql.host') !== '127.0.0.1' || (string) config('database.connections.pgsql.port') !== '5433') {
    throw new RuntimeException('Local DB only');
}
$service = $app->make(KpiService::class);
$start = microtime(true);
$report = $service->report('2026-09', '2026-10');
$admin = User::where('email', 'admin@x3crm.com')->firstOrFail();
$checks = 0;
foreach ($report['periods'] as $period) {
    foreach (['services' => 'service', 'departments' => 'department', 'employees' => 'employee'] as $key => $scope) {
        foreach ($period[$key] as $row) {
            if ($period['metric'] === 'management_fee' && $key !== 'services'
                && round($row['actualAmount'], 2) !== round($row['implementationAmount'], 2)) {
                throw new RuntimeException('Sale credit leaked into implementation KPI');
            }
            if (abs($row['actualAmount']) < 0.01) {
                continue;
            }
            $detail = $service->detail($period['period'], $row['scopeType'] ?? $scope, $row['id'], $admin);
            if (round($detail['totals']['profitAmount'], 2) !== round($row['actualAmount'], 2)) {
                throw new RuntimeException('Detail mismatch '.$period['period'].' '.$key.' '.$row['id']);
            }
            $checks++;
        }
    }
}
$snapshotCounts = Quotation::whereNotNull('kpi_fee_basis')->get(['kpi_fee_basis'])
    ->groupBy(fn ($q) => $q->kpi_fee_basis['classification'])->map->count();
$unclassified = Quotation::with('items')->whereNotNull('kpi_fee_basis')->get()
    ->filter(fn ($q) => $q->kpi_fee_basis['classification'] === 'no_management_fee')
    ->groupBy(fn ($q) => ($q->metadata['pricingMode'] ?? 'unspecified').'|'.implode(',', $q->items->pluck('item_code')->unique()->sort()->all()))
    ->map->count();
$revision = $app->make(KpiController::class)->revision();
if ($revision->getStatusCode() !== 200) {
    throw new RuntimeException('Revision failed');
}
$repo = $app->make(KpiReportRepository::class);
$projects = $repo->activeProjects();
$quotes = $repo->quotations($projects->pluck('id'));
$allocations = $repo->allocations($quotes->pluck('id'));
$refunds = $repo->completedRefunds('2026-09-01', '2026-11-01', $projects->pluck('id'), $quotes->pluck('id'));
$costs = $repo->completedCosts('2026-09-01', '2026-11-01', $projects->pluck('id'));
$october = collect($report['periods'])->last();
$employee = collect($october['employees'])->first(fn ($row) => $row['actualAmount'] > 0);
$department = collect($october['departments'])->first(fn ($row) => $row['actualAmount'] > 0);
$trendMethod = new ReflectionMethod(DashboardService::class, 'buildProfitTrend');
$dashboard = $app->make(DashboardService::class);
// Compare the full-month KPI with a completed-month chart. Intramonth cutoffs are tested separately.
CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-01', 'Asia/Ho_Chi_Minh'));
$trendChecks = 0;
foreach ([
    [['level' => 'own', 'userId' => $employee['id']], $employee['actualAmount']],
    [['level' => 'department', 'departmentIds' => [$department['id']]], $department['actualAmount']],
] as [$scope, $expected]) {
    $trend = $trendMethod->invoke($dashboard,
        CarbonImmutable::parse('2026-10-01'), CarbonImmutable::parse('2026-10-01'),
        CarbonImmutable::parse('2026-09-01'), CarbonImmutable::parse('2026-09-01'),
        $scope, $projects, $quotes, $allocations, $refunds, $costs);
    if (round(collect($trend['points'])->sum('profitAmount'), 2) !== round($expected, 2)) {
        throw new RuntimeException('Dashboard trend mismatch '.$scope['level'].' expected='.$expected.' actual='.$trend['currentAmount'].' cutoff='.$trend['to']);
    }
    $trendChecks++;
}
CarbonImmutable::setTestNow();
echo json_encode(['detailMatches' => $checks, 'seconds' => round(microtime(true) - $start, 2),
    'dashboardTrendMatches' => $trendChecks, 'snapshots' => $snapshotCounts, 'zeroFeeLineTypes' => $unclassified, 'totals' => collect($report['periods'])->map(fn ($p) => [
        'period' => $p['period'], 'metric' => $p['metric'], 'services' => $p['summary']['services']['actualAmount'],
        'employees' => $p['summary']['employees']['actualAmount'],
    ])], JSON_PRETTY_PRINT).PHP_EOL;
