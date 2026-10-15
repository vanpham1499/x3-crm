<?php

require __DIR__.'/../../apps/backend/vendor/autoload.php';

use App\Support\DashboardComparison;
use App\Services\DashboardFinanceService as Finance;
use Carbon\CarbonImmutable as Date;

$checks = 0;
function eqFinance($actual, $expected, string $label): void {
    global $checks;
    if (is_numeric($actual) && is_numeric($expected) ? abs($actual - $expected) > 0.005 : $actual !== $expected) {
        throw new RuntimeException($label.': '.json_encode([$actual, $expected]));
    }
    $checks++;
}
function windowFinance(string $start, string $end, string $now): array {
    return DashboardComparison::range(Date::parse($start, 'Asia/Ho_Chi_Minh'), Date::parse($end, 'Asia/Ho_Chi_Minh'), Date::parse($now, 'Asia/Ho_Chi_Minh'));
}
function eventFinance(string $at, string $kind, float $amount): array {
    return ['at' => Date::parse($at, 'Asia/Ho_Chi_Minh'), 'kind' => $kind, 'amount' => $amount, 'reference' => 'Fixture'];
}
$r = windowFinance('2026-10-01', '2026-10-01', '2026-10-13 10:00:00');
eqFinance($r['previousCutoff']->toDateTimeString(), '2026-09-13 10:00:00', 'Same day and time, not whole previous month');
$cash = Finance::cashProjection($r, [eventFinance('2026-10-01', 'received', 36000000), eventFinance('2026-10-13 09:00', 'refund', 1000000),
    eventFinance('2026-10-13 11:00', 'received', 99000000), eventFinance('2026-09-13 09:00', 'received', 30000000),
    eventFinance('2026-09-14', 'received', 20000000), eventFinance('2026-10-02', 'quotation', 50000000)]);
eqFinance($cash['received'], 36000000, 'Gross receipts include budget, ignore future receipt');
eqFinance($cash['net'], 35000000, 'Net subtracts refund only');
eqFinance($cash['previousNet'], 30000000, 'Prior cutoff respected');
eqFinance($cash['difference'], 5000000, 'Difference');
eqFinance($cash['points'][12]['current'], 35000000, 'Current day cumulative');
eqFinance($cash['points'][13]['current'], null, 'Future day is blank');
eqFinance(count($cash['details']), 3, 'Drilldown contains only comparable receipts and refunds');
eqFinance($cash['points'][12]['previous'], $cash['previousNet'], 'Previous chart matches headline');
eqFinance(DashboardComparison::change(1, 0), null, 'Zero baseline');
eqFinance(DashboardComparison::change(-5, -10), 50, 'Negative baseline');
$q = windowFinance('2026-10-01', '2026-12-01', '2026-11-13 12:00:00');
eqFinance($q['previousStart']->toDateString(), '2026-07-01', 'Previous quarter');
eqFinance($q['previousCutoff']->toDateString(), '2026-08-13', 'Quarter to equivalent month and day');
$quarter = Finance::cashProjection($q, [eventFinance('2026-07-31', 'received', 10), eventFinance('2026-08-13 11:00', 'received', 20), eventFinance('2026-08-14', 'received', 90)]);
eqFinance($quarter['previousNet'], 30, 'Quarter only comparable months');
eqFinance($quarter['points'][1]['previous'], 30, 'Quarter curve matches total');
eqFinance($quarter['points'][2]['current'], null, 'Future quarter month blank');
$feb = windowFinance('2026-02-01', '2026-02-01', '2026-03-10');
$febCash = Finance::cashProjection($feb, [eventFinance('2026-01-31', 'received', 10)]);
eqFinance($febCash['points'][27]['previous'], 10, 'Closed shorter month includes full previous month');
$march = windowFinance('2026-03-01', '2026-03-01', '2026-04-10');
$marchCash = Finance::cashProjection($march, [eventFinance('2026-02-28', 'received', 10)]);
eqFinance($marchCash['points'][30]['previous'], 10, 'Clamp does not count shorter month twice');
$leap = windowFinance('2024-03-01', '2024-03-01', '2024-03-31');
eqFinance($leap['previousCutoff']->toDateString(), '2024-02-29', 'Leap year clamp');
$year = windowFinance('2026-01-01', '2026-12-01', '2026-10-13');
eqFinance($year['previousCutoff']->toDateString(), '2025-10-13', 'Year alignment');
$future = Finance::cashProjection(windowFinance('2026-11-01', '2026-11-01', '2026-10-13'), []);
eqFinance($future['to'], null, 'Future period no claimed cutoff');
eqFinance($future['points'][0]['current'], null, 'Future period no fabricated zero line');
$entries = [['period' => '2026-09', 'kind' => 'revenue', 'amount' => 6000000], ['period' => '2026-09', 'kind' => 'cost', 'amount' => 2000000],
    ['period' => '2026-08', 'kind' => 'revenue', 'amount' => 5000000]];
$profit = Finance::profitProjection(windowFinance('2026-09-01', '2026-09-01', '2026-10-13'), $entries, []);
eqFinance($profit['profit'], 4000000, 'Revenue net of budget minus direct cost');
eqFinance($profit['changeRate'], -20, 'Completed-period comparison');
$pending = Finance::profitProjection($r, [], [['reason' => 'Unconfirmed']]);
eqFinance($pending['comparable'], false, 'Unconfirmed ledger not final profit');
eqFinance($pending['changeRate'], null, 'No fake percentage with unassigned costs');
eqFinance(Finance::profitProjection($r, [], [])['comparable'], false, 'Monthly ledger cannot claim daily same-period comparison');
echo "$checks finance projection checks passed\n";
