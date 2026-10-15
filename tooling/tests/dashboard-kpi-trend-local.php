<?php

require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $e): void { fwrite(STDERR, (string) $e); exit(1); });
if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.host') !== '127.0.0.1'
    || (string) config('database.connections.pgsql.port') !== '5433') {
    throw new RuntimeException('Local DB 127.0.0.1:5433 only');
}

use App\Models\User;
use App\Services\DashboardService;
use Carbon\CarbonImmutable as Date;
use Illuminate\Support\Facades\DB;

DB::beginTransaction();
try {
    DB::statement('SET TRANSACTION READ ONLY');
    $user = User::where('code', 'NV009')->firstOrFail();
    request()->setUserResolver(fn () => $user);
    Date::setTestNow(Date::parse('2026-10-14 10:00', 'Asia/Ho_Chi_Minh'));
    $checks = 0;
    foreach ([['2026-10', '2026-10'], ['2026-09', '2026-09'], ['2026-07', '2026-09']] as [$from, $to]) {
        $report = app(DashboardService::class)->report($from, $to);
        $trend = $report['profitTrend'];
        if ($trend === null) throw new RuntimeException('Expected scoped report');
        $points = array_values(array_filter($trend['points'], fn ($p) => $p['cumulativeProfitAmount'] !== null));
        $last = $points[count($points) - 1];
        foreach ([[$report['summary']['profitAmount'], $trend['currentAmount']],
            [$last['cumulativeProfitAmount'], $trend['currentAmount']],
            [$last['previousCumulativeProfitAmount'], $trend['previousAmount']],
            [$report['summary']['profitChangeRate'], $trend['changeRate']]] as [$actual, $expected]) {
            if ($actual !== $expected) throw new RuntimeException('Summary/endpoint mismatch for '.$from);
            $checks++;
        }
        if ($from === '2026-10' && ($trend['comparisonReason'] !== 'different_basis' || $trend['difference'] !== null)) {
            throw new RuntimeException('Policy boundary comparison must be suppressed');
        }
    }
    echo "PASS {$checks} read-only local Dashboard summary/endpoint checks\n";
} finally {
    Date::setTestNow();
    DB::rollBack();
}
