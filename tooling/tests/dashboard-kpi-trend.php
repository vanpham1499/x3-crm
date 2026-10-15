<?php

require __DIR__.'/../../apps/backend/vendor/autoload.php';

use App\Support\DashboardKpiTrend;
use Carbon\CarbonImmutable as Date;

$checks = 0;
function checkTrend(mixed $actual, mixed $expected, string $label): void {
    global $checks;
    if (is_numeric($actual) && is_numeric($expected) ? abs($actual - $expected) > 0.005 : $actual !== $expected) {
        throw new RuntimeException($label.': '.json_encode([$actual, $expected]));
    }
    $checks++;
}
function kpiEvent(string $at, float $amount): array {
    return ['at' => Date::parse($at, 'Asia/Ho_Chi_Minh'), 'amount' => $amount];
}
function kpiTrend(string $from, string $to, string $now, array $events): array {
    return DashboardKpiTrend::project(Date::parse($from.'-01'), Date::parse($to.'-01'), Date::parse($now, 'Asia/Ho_Chi_Minh'), $events);
}
$events = [kpiEvent('2026-11-01', 5000000), kpiEvent('2026-11-03', 7000000), kpiEvent('2026-11-04', -1000000),
    kpiEvent('2026-11-14 09:00', 900000), kpiEvent('2026-11-14 11:00', 99000000),
    kpiEvent('2026-10-01', 3000000), kpiEvent('2026-10-14 09:00', 10000000), kpiEvent('2026-10-14 11:00', 999000000)];
$trend = kpiTrend('2026-11', '2026-11', '2026-11-14 10:00', $events);
checkTrend($trend['currentAmount'], 11900000, 'Accumulated receipts minus real refund, no future receipts');
checkTrend($trend['previousAmount'], 13000000, 'Previous same day and time cutoff');
checkTrend($trend['difference'], -1100000, 'Gap to same period');
checkTrend($trend['changeRate'], -8.46, 'Same-period percent');
checkTrend($trend['points'][1]['cumulativeProfitAmount'], 5000000, 'No-activity day is flat');
checkTrend($trend['points'][2]['cumulativeProfitAmount'], 12000000, 'Cumulative instead of daily');
checkTrend($trend['points'][3]['cumulativeProfitAmount'], 11000000, 'Refund can lower cumulative value');
checkTrend($trend['points'][13]['cumulativeProfitAmount'], $trend['currentAmount'], 'Current endpoint equals total');
checkTrend($trend['points'][13]['previousCumulativeProfitAmount'], $trend['previousAmount'], 'Previous endpoint equals total');
checkTrend($trend['points'][14]['cumulativeProfitAmount'], null, 'Future has no current data');
checkTrend($trend['points'][14]['previousCumulativeProfitAmount'], null, 'Comparison only same elapsed period');
$policy = kpiTrend('2026-10', '2026-10', '2026-10-14', [kpiEvent('2026-10-01', 10), kpiEvent('2026-09-01', 40)]);
checkTrend($policy['currentAmount'], 10, 'Keep raw current data across policy boundary');
checkTrend($policy['previousAmount'], 40, 'Keep historical data across policy boundary');
checkTrend($policy['comparisonReason'], 'different_basis', 'Oct vs Sep policy difference');
checkTrend($policy['difference'], null, 'No misleading gap across policy change');
checkTrend($policy['changeRate'], null, 'No misleading rate across policy change');
checkTrend($policy['points'][0]['difference'], null, 'No misleading point tooltip difference');
$quarter = kpiTrend('2027-04', '2027-06', '2027-05-14 10:00', [kpiEvent('2027-04-01', 10), kpiEvent('2027-05-14 09:00', 20),
    kpiEvent('2027-05-15', 999), kpiEvent('2027-01-31', 5), kpiEvent('2027-02-14 09:00', 10), kpiEvent('2027-02-15', 999)]);
checkTrend($quarter['currentAmount'], 30, 'Partial quarter excludes later dates');
checkTrend($quarter['previousAmount'], 15, 'Partial quarter uses equivalent day');
checkTrend($quarter['points'][1]['previousTo'], '2027-02-14', 'Quarter prior cutoff label');
checkTrend($quarter['points'][2]['cumulativeProfitAmount'], null, 'Future month is blank');
$short = kpiTrend('2027-02', '2027-02', '2027-03-10', [kpiEvent('2027-01-29', 10), kpiEvent('2027-01-31', 20)]);
checkTrend($short['previousAmount'], 30, 'Completed short month includes full longer prior month');
checkTrend($short['points'][27]['previousTo'], '2027-01-31', 'Explicit last-day comparison date');
$long = kpiTrend('2027-03', '2027-03', '2027-03-31 12:00', [kpiEvent('2027-02-28 11:00', 20), kpiEvent('2027-02-28 13:00', 99)]);
checkTrend($long['previousAmount'], 20, 'Day 31 clamps with matching time');
checkTrend($long['points'][30]['previousCumulativeProfitAmount'], 20, 'Clamp does not count prior day repeatedly');
$leap = kpiTrend('2028-02', '2028-02', '2028-03-02', []);
checkTrend(count($leap['points']), 29, 'Leap year daily axis');
$future = kpiTrend('2026-12', '2026-12', '2026-11-14', [kpiEvent('2026-12-01', 99)]);
checkTrend($future['comparisonReason'], 'future', 'Future range is explicit');
checkTrend($future['currentAmount'], 0, 'No booked future KPI reported as actual');
checkTrend(count(array_filter($future['points'], fn ($p) => $p['cumulativeProfitAmount'] !== null)), 0, 'All future points blank');
$zero = kpiTrend('2026-11', '2026-11', '2026-11-14', [kpiEvent('2026-11-01', 10)]);
checkTrend($zero['changeRate'], null, 'No division by zero');
checkTrend($zero['difference'], 10, 'Absolute gap still usable with zero baseline');
$negative = kpiTrend('2026-11', '2026-11', '2026-11-14', [kpiEvent('2026-10-01', -10), kpiEvent('2026-11-01', -5)]);
checkTrend($negative['changeRate'], 50, 'Improvement from negative baseline');
$zone = kpiTrend('2026-11', '2026-11', '2026-11-01 01:00', [['at' => Date::parse('2026-10-31 17:30:00', 'UTC'), 'amount' => 7]]);
checkTrend($zone['currentAmount'], 7, 'UTC event belongs to Nov 1 Vietnam');
checkTrend($zone['points'][0]['cumulativeProfitAmount'], 7, 'Local midnight event in first daily bucket');
$mixed = kpiTrend('2026-10', '2026-12', '2027-01-01', []);
checkTrend($mixed['comparable'], false, 'Quarter spanning different policies not comparable');
// Exercise the service's scope filtering with dated fee events, without a database or writes.
$fakeKpi = new class extends App\Services\KpiService {
    public function __construct() {}
    public function paidFirstQuotations(Illuminate\Support\Collection $quotations, Illuminate\Support\Collection $allocations): Illuminate\Support\Collection {
        return collect();
    }
    public function feeEvents(string $from, string $to): Illuminate\Support\Collection {
        return collect([
            kpiEvent('2026-11-01', 10) + ['basis' => ['managerId' => 1, 'salesId' => 2, 'firstQuotation' => true, 'managerDepartmentId' => 8, 'salesDepartmentId' => 9]],
            kpiEvent('2026-11-02', 20) + ['basis' => ['managerId' => 1, 'salesId' => 2, 'firstQuotation' => false, 'managerDepartmentId' => 8, 'salesDepartmentId' => 9]],
            kpiEvent('2026-11-03', -3) + ['basis' => ['managerId' => 1, 'salesId' => 2, 'firstQuotation' => true, 'managerDepartmentId' => 8, 'salesDepartmentId' => 9]],
            kpiEvent('2026-11-04', 5) + ['basis' => ['managerId' => 3, 'salesId' => 3, 'firstQuotation' => true, 'managerDepartmentId' => 10, 'salesDepartmentId' => 10]],
        ]);
    }
};
$service = (new ReflectionClass(App\Services\DashboardService::class))->newInstanceWithoutConstructor();
(new ReflectionProperty($service, 'kpi'))->setValue($service, $fakeKpi);
$method = new ReflectionMethod($service, 'buildProfitTrend');
Date::setTestNow(Date::parse('2026-11-14', 'Asia/Ho_Chi_Minh'));
try {
    $scoped = fn ($scope) => $method->invoke($service, Date::parse('2026-11-01'), Date::parse('2026-11-01'),
        Date::parse('2026-10-01'), Date::parse('2026-10-01'), $scope, collect(), collect(), collect(), collect(), collect());
    checkTrend($scoped(['level' => 'personal', 'userId' => 1])['currentAmount'], 27, 'Implementation gets every quotation and refund');
    checkTrend($scoped(['level' => 'personal', 'userId' => 2])['currentAmount'], 7, 'Sale only gets first quotation minus refund');
    checkTrend($scoped(['level' => 'personal', 'userId' => 3])['currentAmount'], 10, 'Existing dual-role credits preserved');
    checkTrend($scoped(['level' => 'personal', 'userId' => 4])['currentAmount'], 0, 'Unrelated employee cannot see another credit');
    checkTrend($scoped(['level' => 'department', 'departmentIds' => [9]])['currentAmount'], 7, 'Department receives only its scoped credits');
} finally {
    Date::setTestNow();
}
echo "PASS {$checks} cumulative KPI checks\n";
