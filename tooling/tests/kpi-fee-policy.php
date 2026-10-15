<?php

// In-memory model fixtures only; never connects to the CRM database.
require __DIR__.'/../../apps/backend/vendor/autoload.php';

use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Services\KpiFeeEvents;
use App\Services\KpiService;
use App\Support\KpiFeeBasis;

$checks = 0;
function verifyFee($actual, $expected, string $label): void
{
    global $checks;
    if ($actual !== $expected) {
        throw new RuntimeException($label.': '.json_encode([$actual, $expected]));
    }
    $checks++;
}
function receipt(int $id, float $amount, string $date): PaymentAllocation
{
    $row = new PaymentAllocation(['quotation_id' => 1, 'amount' => (string) $amount]);
    $row->id = $id;
    $row->setRawAttributes(array_merge($row->getAttributes(), ['allocated_at' => $date]));
    $row->setRelation('payment', null);

    return $row;
}
function refund(int $id, float $fee, float $budget, string $date, string $type = 'payment'): PaymentRefund
{
    $row = new PaymentRefund(['quotation_id' => 1, 'amount' => (string) ($fee + $budget),
        'service_fee_refund_amount' => (string) $fee, 'budget_refund_amount' => (string) $budget,
        'refund_type' => $type, 'status' => 'completed']);
    $row->id = $id;
    $row->setRawAttributes(array_merge($row->getAttributes(), ['completed_at' => $date]));

    return $row;
}
$basis = ['fee' => 6000000.0, 'feeGross' => 6600000.0, 'billableGross' => 39600000.0,
    'deposit' => 0.0, 'projectId' => 1, 'serviceId' => 2, 'managerId' => 10,
    'managerDepartmentId' => 3, 'salesId' => 11, 'salesDepartmentId' => 4,
    'firstQuotation' => true];
$quote = new Quotation;
$quote->id = 1;
$quote->kpi_fee_basis = $basis;
$events = fn ($receipts, $refunds = []) => KpiFeeEvents::build(collect([$quote]), collect($receipts), collect($refunds));
verifyFee(KpiFeeBasis::applies('2026-09'), false, 'September retains legacy');
verifyFee(KpiFeeBasis::applies('2026-10'), true, 'October fee policy');
$classificationQuote = new Quotation;
$classificationQuote->setRelation('project', null);
$classificationQuote->setRelation('items', collect([
    new QuotationItem(['item_code' => '-1', 'amount_before_vat' => '30000000', 'vat_amount' => '3000000']),
    new QuotationItem(['item_code' => '-2', 'amount_before_vat' => '6000000', 'vat_amount' => '600000']),
    new QuotationItem(['item_code' => '-3', 'amount_before_vat' => '1000000', 'vat_amount' => '100000']),
]));
verifyFee(KpiFeeBasis::capture($classificationQuote)['fee'], 6000000.0, 'Only explicit management fee is credited');
$classificationQuote->items[1]->metadata = ['excludedFromTotal' => true];
verifyFee(KpiFeeBasis::capture($classificationQuote)['fee'], 0.0, 'Excluded fee cannot earn KPI');
$classificationQuote->items[1]->metadata = [];
$classificationQuote->items[1]->item_code = 'manual';
verifyFee(KpiFeeBasis::capture($classificationQuote)['classification'], 'no_management_fee', 'Manual lines are not guessed as management fees');
verifyFee(KpiFeeBasis::recognized($basis, 19800000), 3000000.0, 'Half payment excludes budget and VAT');
verifyFee(KpiFeeBasis::recognized($basis, 99000000), 6000000.0, 'Overpayment capped');
$depositBasis = array_merge($basis, ['deposit' => 2000000]);
verifyFee(KpiFeeBasis::recognized($depositBasis, 2000000), 0.0, 'Deposit alone earns no fee');
verifyFee(KpiFeeBasis::recognized($depositBasis, 21800000), 3000000.0, 'Deposit plus half payment');
$split = $events([receipt(1, 19800000, '2026-10-03'), receipt(2, 19800000, '2026-11-03')]);
verifyFee($split->pluck('amount')->all(), [3000000.0, 3000000.0], 'Partial payments recognized in separate months');
verifyFee($split->map(fn ($e) => $e['at']->format('Y-m'))->all(), ['2026-10', '2026-11'], 'Payment event periods');
verifyFee($events([receipt(1, 39600000, '2026-09-03'), receipt(2, 1000, '2026-10-03')])->count(), 0, 'No double recognition across cutover');
$full = [receipt(1, 39600000, '2026-10-03')];
verifyFee($events($full, [refund(1, 0, 5000000, '2026-10-04')])->sum('amount'), 6000000.0, 'Budget refund leaves KPI intact');
verifyFee($events($full, [refund(1, 1100000, 0, '2026-11-04')])->pluck('amount')->all(), [6000000.0, -1000000.0], 'Fee refund before VAT in refund month');
verifyFee($events($full, [refund(1, 9000000, 0, '2026-11-04'), refund(2, 9000000, 0, '2026-11-05')])->sum('amount'), 0.0, 'Refund cannot exceed earned fee');
verifyFee($events($full, [refund(1, 500000, 0, '2026-11-04', 'deposit')])->sum('amount'), 6000000.0, 'Deposit refund has no fee impact');
verifyFee($events($full, [refund(1, 500000, 0, '2026-11-04', 'overpayment')])->sum('amount'), 6000000.0, 'Surplus refund has no fee impact');
verifyFee($events($full, [refund(1, 500000, 0, '2026-11-04', 'compensation')])->sum('amount'), 6000000.0, 'Compensation remains outside fee KPI');
// Single rounding on cumulative recognition, independent of receipt splitting.
$pieces = collect(range(1, 99))->map(fn ($id) => receipt($id, 400000, '2026-10-03'))->all();
verifyFee(round($events($pieces)->sum('amount'), 2), 6000000.0, '99 split receipts equal one full receipt');
// The same event must reach service exactly once, and the two authorized roles separately.
$service = (new ReflectionClass(KpiService::class))->newInstanceWithoutConstructor();
$apply = new ReflectionMethod(KpiService::class, 'applyFeeEvent');
$fields = ['implementationReceivedAmount', 'implementationReceivedBeforeVatAmount', 'implementationRefundAmount', 'implementationRefundBeforeVatAmount', 'acquisitionCreditAmount', 'acquisitionCreditBeforeVatAmount', 'acquisitionRefundAmount', 'acquisitionRefundBeforeVatAmount'];
$zero = array_fill_keys($fields, 0.0);
$services = [2 => ['receivedAmount' => 0.0, 'receivedBeforeVatAmount' => 0.0]];
$departments = [3 => $zero, 4 => $zero];
$employees = [10 => $zero, 11 => $zero];
$event = $split->first();
$apply->invokeArgs($service, [$event, &$services, &$departments, &$employees]);
verifyFee($services[2]['receivedBeforeVatAmount'], 3000000.0, 'Company fee counted once');
verifyFee($employees[10]['implementationReceivedBeforeVatAmount'], 3000000.0, 'Implementation credit');
verifyFee($employees[11]['acquisitionCreditBeforeVatAmount'], 3000000.0, 'First quotation sales credit');
$event['basis']['firstQuotation'] = false;
$apply->invokeArgs($service, [$event, &$services, &$departments, &$employees]);
verifyFee($employees[10]['implementationReceivedBeforeVatAmount'], 6000000.0, 'Renewal implementation credit');
verifyFee($employees[11]['acquisitionCreditBeforeVatAmount'], 3000000.0, 'Renewal gives no sales credit');
$event['basis']['firstQuotation'] = true;
$event['basis']['salesId'] = 10;
$apply->invokeArgs($service, [$event, &$services, &$departments, &$employees]);
verifyFee($employees[10]['acquisitionCreditBeforeVatAmount'], 3000000.0, 'Dual role remains two explicit branches');
echo "$checks KPI fee checks passed\n";
