<?php

// In-memory models only. Every relation used by the calculators is supplied;
// no production/local database is queried or modified.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default' => 'finance_test', 'database.connections.finance_test' => [
    'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '',
]]);
set_exception_handler(function (Throwable $error): void { fwrite(STDERR, (string) $error); exit(1); });

use App\Models\{Quotation, QuotationItem, PaymentAllocation, PaymentRefund, Project, ProjectCost, ProjectCostCidIncident};
use App\Support\{ProjectTopupBudgetCalculator as Budget, QuotationFinancialBasis as Basis, QuotationServiceRevenue as Revenue};
use Illuminate\Database\Eloquent\Collection;

$checks = 0;
function same($actual, $expected, string $label): void {
    global $checks;
    if (is_numeric($actual) && is_numeric($expected)) {
        if (abs($actual - $expected) > 0.005) throw new RuntimeException("$label: $actual != $expected");
    } elseif ($actual !== $expected) throw new RuntimeException($label.': '.json_encode([$actual, $expected]));
    $checks++;
}
function line(string $code, float $before, float $vat = 0, array $metadata = []): QuotationItem {
    return new QuotationItem(['item_code' => $code, 'item_name' => 'Fixture', 'amount_before_vat' => $before,
        'vat_amount' => $vat, 'amount_after_vat' => $before + $vat, 'metadata' => $metadata]);
}
function quote(string $type, array $items, float $paid, float $budget = 39140620, float $deposit = 0): Quotation {
    $included = collect($items)->reject(fn ($item) => Basis::excluded($item));
    $subtotal = (float) $included->sum('amount_before_vat');
    $vat = (float) $included->sum('vat_amount');
    $q = new Quotation(['quotation_code' => "869.DV1.$type.TEST.Q001", 'subtotal_amount' => $subtotal,
        'vat_amount' => $vat, 'vat_rate' => 8, 'total_amount' => $subtotal + $vat + $deposit,
        'deposit_amount' => $deposit, 'metadata' => ['projectType' => $type, 'budget' => $budget,
            'depositMode' => Quotation::DEPOSIT_MODE_NON_TAXABLE_ADDITION]]);
    $q->setRelation('items', new Collection($items));
    $q->setRelation('paymentAllocations', new Collection([new PaymentAllocation(['amount' => $paid])]));
    $q->setRelation('paymentRefunds', new Collection());
    return $q;
}
function refund(Quotation $q, float $amount, ?float $budget, ?float $fee, string $type = 'payment', string $status = 'completed'): void {
    $q->paymentRefunds->push(new PaymentRefund(['refund_type' => $type, 'status' => $status,
        'amount' => $amount, 'budget_refund_amount' => $budget, 'service_fee_refund_amount' => $fee]));
}
function revenue(Quotation $q): array { return Revenue::calculate($q, Budget::calculateQuotation($q)); }

$k = quote('K', [line('-1', 39140620, 0, ['excludedFromTotal' => true]), line('-2', 5871093, 469687)], 6340780);
same(Budget::calculateQuotation($k)['eligibleBudget'], 0, 'K reference budget not eligible');
same(Budget::calculateQuotation($k)['paidBudget'], 0, 'K paid fee not topup');
same(revenue($k)['collectedBeforeVat'], 5871093, 'Screenshot fee excludes VAT');
same(revenue($k)['needsReview'], false, 'Valid K classified');
$k->topup_credit_enabled = true; $k->topup_credit_limit = 1000000;
same(Budget::calculateQuotation($k)['creditBudget'], 0, 'Legacy K credit cannot release money');
$k->setRelation('project', new Project(['project_type' => 'M']));
same(Budget::calculateQuotation($k)['eligibleBudget'], 0, 'Current project type cannot rewrite snapshot');
$k->metadata = ['budget' => 39140620];
same(Budget::calculateQuotation($k)['eligibleBudget'], 0, 'Quotation code fallback keeps K');
$partial = quote('K', $k->items->all(), 3170390);
same(revenue($partial)['collectedBeforeVat'], 2935546.5, 'Half payment recognizes half net fee');
$unpaid = quote('K', $k->items->all(), 0);
same(revenue($unpaid)['collectedBeforeVat'], 0, 'Unpaid has no profit');
$deposit = quote('K', $k->items->all(), 1000000, 39140620, 1000000);
same(revenue($deposit)['collectedBeforeVat'], 0, 'Deposit is not revenue');
refund($partial, 108000, 0, 108000);
same(revenue($partial)['collectedBeforeVat'], round(2935546.5 - 108000 * 5871093 / 6340780, 2), 'Fee refund deducts fee excluding VAT');
same(Budget::calculateQuotation($partial)['releasedBudget'], 0, 'Refund cannot give K topup');
$full = quote('K', $k->items->all(), 6340780);
refund($full, 6340780, 0, 6340780);
same(revenue($full)['collectedBeforeVat'], 0, 'Full refund resets fee');
$pending = quote('K', $k->items->all(), 6340780);
refund($pending, 6340780, 0, 6340780, 'payment', 'pending');
same(revenue($pending)['collectedBeforeVat'], 5871093, 'Pending refund has no financial effect');
$full->voided_at = '2026-10-13 01:00:00';
same(Budget::calculateQuotation($full)['releasedBudget'], 0, 'Voided cannot fund');
same(revenue($full)['collectedBeforeVat'], 0, 'Voided cannot earn');

$mItems = [line('-1', 10000000, 800000), line('-2', 1500000, 120000)];
$m = quote('M', $mItems, 12420000, 10000000);
same(Budget::calculateQuotation($m)['eligibleBudget'], 10800000, 'M includes funded budget VAT');
same(Budget::calculateQuotation($m)['paidBudget'], 10800000, 'M paid cap');
same(revenue($m)['collectedBeforeVat'], 1500000, 'M excludes budget from service fee');
$mPartial = quote('M', $mItems, 3000000, 10000000);
$mPartial->topup_credit_enabled = true; $mPartial->topup_credit_limit = 4000000;
same(Budget::calculateQuotation($mPartial)['releasedBudget'], 7000000, 'Paid plus approved credit');
$mPartial->paymentAllocations->push(new PaymentAllocation(['amount' => 7000000]));
same(Budget::calculateQuotation($mPartial)['creditBudget'], 800000, 'Credit decreases as receipts arrive');
refund($m, 2000000, 2000000, 0);
same(Budget::calculateQuotation($m)['paidBudget'], 8800000, 'Budget refund reduces topup');
same(revenue($m)['collectedBeforeVat'], 1500000, 'Budget refund preserves service fee');
$m->topup_credit_enabled = true; $m->topup_credit_limit = 10800000;
same(Budget::calculateQuotation($m)['creditBudget'], 0, 'Refund cannot regenerate credit');
$legacyRefund = quote('M', $mItems, 12420000, 10000000);
refund($legacyRefund, 1242000, null, null);
same(revenue($legacyRefund)['collectedBeforeVat'], 1350000, 'Unsplit legacy refund uses revenue proportion');
$mFull = quote('M', $mItems, 12420000, 10000000);
$mFull->topup_credit_enabled = true; $mFull->topup_credit_limit = 1000000;
refund($mFull, 12420000, 10800000, 1620000);
same(Budget::calculateQuotation($mFull)['releasedBudget'], 0, 'Full M refund zeros credit and receipts');

$excluded = quote('M', [line('-1', 1000, 0, ['excludedFromTotal' => true]),
    line('extra', 500, 40, ['excludedFromTotal' => true, 'countsTowardTopupBudget' => true]), line('-2', 100)], 100, 1000);
same(Budget::calculateQuotation($excluded)['eligibleBudget'], 0, 'Excluded base and extras never eligible');
$extra = quote('M', [...$mItems, line('manual', 1000000, 80000, ['countsTowardTopupBudget' => true])], 13500000, 10000000);
same(Budget::calculateQuotation($extra)['eligibleBudget'], 11880000, 'Explicit extra topup included once');
same(revenue($extra)['collectedBeforeVat'], 1500000, 'Extra topup not service income');
$kFlags = quote('K', [line('-2', 100, 8, ['countsTowardTopupBudget' => true])], 108, 0);
same(Budget::calculateQuotation($kFlags)['eligibleBudget'], 0, 'Invalid K flags cannot create budget');
same(revenue($kFlags)['collectedBeforeVat'], 100, 'K remains service income');
$missing = quote('M', [line('-2', 1500000, 120000)], 12420000, 10000000);
same(Budget::calculateQuotation($missing)['eligibleBudget'], 10800000, 'Legacy M metadata fallback retained');
same(revenue($missing)['needsReview'], true, 'Missing line requires revenue audit');
same(revenue($missing)['collectedBeforeVat'], null, 'Do not fabricate legacy profit');
$unknown = quote('?', [], 1000, 1000);
same(Budget::calculateQuotation($unknown)['eligibleBudget'], 0, 'Unknown metadata alone cannot fund');
same(revenue($unknown)['needsReview'], true, 'Unknown legacy marked for audit');

$project = new Project();
$project->setRelation('quotations', new Collection([$k]));
$cost = new ProjectCost(['entry_type' => 'ad_spend', 'status' => 'completed', 'total_amount' => 1000000]);
$cost->setRelation('cidIncident', null);
$project->setRelation('costs', new Collection([$cost]));
same(Budget::calculate($project)['hasTopupBudgetSource'], false, 'K not an active source');
same(Budget::calculate($project)['availableBudget'], -1000000, 'Keep old overspend visible');
$project->setRelation('quotations', new Collection([$m]));
$cost->setRelation('cidIncident', new ProjectCostCidIncident(['status' => 'pending', 'released_amount' => 400000]));
same(Budget::calculate($project)['usedBudget'], 1000000, 'Pending CID does not release funds');
$cost->cidIncident->status = 'confirmed';
same(Budget::calculate($project)['usedBudget'], 600000, 'Confirmed CID restores original budget');
same(Budget::calculate($project)['availableBudget'], 8200000, 'M available after refund and CID');

$service = (new ReflectionClass(App\Services\QuotationsService::class))->newInstanceWithoutConstructor();
try {
    (new ReflectionMethod($service, 'validateTopupCreditLimit'))->invoke($service, $k);
    throw new RuntimeException('K credit request should be rejected');
} catch (Illuminate\Validation\ValidationException $error) {
    same(isset($error->errors()['topupCreditLimit']), true, 'Backend rejects K credit approval');
}
try {
    (new ReflectionMethod($service, 'syncTopupBudgetItems'))->invoke($service, $k, [123]);
    throw new RuntimeException('K topup flags should be rejected');
} catch (Illuminate\Validation\ValidationException $error) {
    same(isset($error->errors()['topupBudgetItemIds']), true, 'Backend rejects K source reclassification');
}
$flaggedFee = quote('M', [line('-1', 1000, 80), line('-2', 100, 8, ['countsTowardTopupBudget' => true]),
    line('-3', 100, 8, ['countsTowardTopupBudget' => true])], 1296, 1000);
same(Budget::calculateQuotation($flaggedFee)['eligibleBudget'], 1080, 'M fee and setup never become topup');
same(revenue($flaggedFee)['collectedBeforeVat'], 200, 'M fee and setup retained as service');
$api = (new App\Http\Resources\QuotationResource($k))->toArray(Illuminate\Http\Request::create('/api/quotations/1'));
same($api['topupEligibleAmount'], 0, 'API exposes corrected K source');
same($api['serviceCollectedBeforeVat'], 5871093, 'API exposes service income excluding VAT');
same($api['financialNeedsReview'], false, 'API review flag');
$overpaid = quote('K', $k->items->all(), 7340780);
same(revenue($overpaid)['collectedBeforeVat'], 5871093, 'Surplus does not increase service revenue');
refund($overpaid, 108000, 0, 108000);
same(revenue($overpaid)['needsReview'], true, 'Refund and overcollection require reconciliation');
$depositReturned = quote('K', $k->items->all(), 7340780, 39140620, 1000000);
refund($depositReturned, 1000000, null, null, 'deposit');
same(revenue($depositReturned)['collectedBeforeVat'], 5871093, 'Deposit return does not reduce service fee');
$promoQuote = quote('M', [line('-1', 3000000)], 3000000, 3000000);
$promoQuote->metadata = array_merge($promoQuote->metadata, ['promotionBudget' => 3000000]);
$cashTopup = new ProjectCost(['entry_type' => 'ad_spend', 'status' => 'completed', 'total_amount' => 3000000]);
$cashTopup->setRelation('cidIncident', null);
$grant = new ProjectCost(['entry_type' => 'ad_spend', 'funding_source' => 'promotion', 'status' => 'completed', 'total_amount' => 3000000]);
$grant->setRelation('cidIncident', null);
$project->setRelation('quotations', new Collection([$promoQuote]));
$project->setRelation('costs', new Collection([$cashTopup, $grant]));
$split = Budget::calculate($project);
same($split['paidBudget'], 3000000, 'MKM never increases customer receipt');
same($split['usedBudget'], 3000000, 'Only cash consumes funded budget');
same($split['availableBudget'], 0, 'No fictitious 3m cash available after topup');
same($split['promotionAvailable'], 3000000, 'Gift remains available separately');
same(revenue($promoQuote)['collectedBeforeVat'], 0, 'Advertising principal and gift are not management fees');
foreach ([App\Services\DashboardService::class, App\Services\KpiService::class] as $class) {
    $instance = (new ReflectionClass($class))->newInstanceWithoutConstructor();
    $amounts = (new ReflectionMethod($instance, 'costAmounts'))->invoke($instance, $grant);
    same($amounts['gross'], 0, $class.' excludes promotional value');
    same($amounts['beforeVat'], 0, $class.' excludes promotional expense');
}
echo "$checks project finance checks passed\n";
