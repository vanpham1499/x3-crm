<?php

// Pure amount/model tests; no connection to local or production databases.
require __DIR__.'/../../apps/backend/vendor/autoload.php';

use App\Models\WeeklyReport;
use App\Support\WeeklyReportMoney;

$checks = 0;
function checkBudget($actual, $expected, string $message): void
{
    global $checks;
    if ($actual !== $expected) throw new RuntimeException($message.': '.json_encode([$actual, $expected]));
    $checks++;
}
foreach ([['15000000', '3500000.00'], ['30000000', '7000000.00'], ['0', '0.00'],
    ['0.01', '0.00'], ['0.15', '0.04'], ['100', '23.33'], ['1234.56', '288.06'],
    ['9999999999999.99', '2333333333333.33'], ['300.50', '70.12']] as [$total, $expected]) {
    checkBudget(WeeklyReportMoney::calculateWeeklyBudget($total), $expected, $total);
}
$legacy = new WeeklyReport(['currency' => 'VND', 'total_budget' => '15000000.00', 'average_weekly_budget' => '3750000.00']);
foreach (['draft', 'submitted', 'approved', 'rejected'] as $status) {
    $legacy->status = $status;
    foreach ([['summary' => 'Edited'], ['total_budget' => '15000000.00'], ['average_weekly_budget' => '999']] as $input) {
        checkBudget(array_key_exists('average_weekly_budget', WeeklyReportMoney::applyWeeklyBudget($input, $legacy)), false, 'Preserve '.$status);
    }
}
checkBudget(WeeklyReportMoney::applyWeeklyBudget(['total_budget' => '30000000.00'], $legacy)['average_weekly_budget'], '7000000.00', 'Recalculate changed total');
checkBudget(WeeklyReportMoney::applyWeeklyBudget(['currency' => 'USD', 'total_budget' => '300.50'], $legacy)['average_weekly_budget'], '70.12', 'Changed currency');
checkBudget(WeeklyReportMoney::applyWeeklyBudget(['total_budget' => '15000000.00', 'average_weekly_budget' => '1'])['average_weekly_budget'], '3500000.00', 'Server owns new average');
checkBudget($legacy->average_weekly_budget, '3750000.00', 'Original model untouched');
// Validation smoke test on a disposable SQLite connection, never the configured CRM DB.
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $error): void {
    fwrite(STDERR, $error->getMessage().PHP_EOL);
    exit(1);
});
if (! extension_loaded('pdo_sqlite')) {
    throw new RuntimeException('Run with -d extension=pdo_sqlite -d extension=sqlite3');
}
config(['database.default' => 'budget_test', 'database.connections.budget_test' => [
    'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '',
]]);
Illuminate\Support\Facades\DB::purge('budget_test');
Illuminate\Support\Facades\Schema::create('options', function ($t) {
    $t->id(); $t->string('group'); $t->string('key'); $t->string('value');
    $t->boolean('is_active'); $t->integer('sort_order'); $t->softDeletes();
});
$data = WeeklyReportMoney::prepare(['currency' => 'USD', 'weekly_spend_amount' => '20.12', 'total_budget' => '300.50']);
checkBudget(WeeklyReportMoney::applyWeeklyBudget($data)['average_weekly_budget'], '70.12', 'Foreign currency does not require manual average');
$data = WeeklyReportMoney::prepare(['total_budget' => '15000000', 'summary' => 'Changed'], $legacy);
checkBudget(array_key_exists('average_weekly_budget', WeeklyReportMoney::applyWeeklyBudget($data, $legacy)), false, 'Normalized legacy total preserved');
echo "$checks budget checks passed\n";
