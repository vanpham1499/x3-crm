<?php

// Explicit local-only runner. Fixtures and all test writes are rolled back.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
set_exception_handler(function (Throwable $e): void { fwrite(STDERR, (string) $e); exit(1); });
if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.host') !== '127.0.0.1'
    || (string) config('database.connections.pgsql.port') !== '5433') throw new RuntimeException('Local DB only: 127.0.0.1:5433');
if (in_array('--migrate', $argv, true)) {
    $result = $kernel->call('migrate', ['--path' => 'database/migrations/2026_10_13_000400_create_partner_finance_ledger.php', '--force' => true]);
    echo $kernel->output(); exit($result);
}

use App\Models\{User, Project, ProjectCost, Quotation, QuotationItem, PartnerCostPayment};
use App\Services\{PartnerFinanceService, ProjectCostsService};
use App\Support\PartnerFinance;
use Illuminate\Support\Facades\{DB, Auth};
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

$checks = 0;
function eq($a, $b, string $label): void { global $checks; if (is_numeric($a) && is_numeric($b) ? abs($a - $b) > 0.005 : $a !== $b) throw new RuntimeException($label.': '.json_encode([$a, $b])); $checks++; }
function rejects(callable $fn, string $label): void { global $checks; try { $fn(); } catch (ValidationException $e) { $checks++; return; } throw new RuntimeException('Expected rejection: '.$label); }
DB::beginTransaction();
try {
    DB::select('SELECT pg_advisory_xact_lock(88124019)');
    $admin = User::where('role', 'ADMIN')->firstOrFail();
    Auth::setUser($admin); request()->setUserResolver(fn () => $admin);
    DB::table('partner_finance_periods')->whereIn('period', ['2026-09', '2026-10'])->delete();
    $project = Project::firstOrFail()->replicate();
    $project->project_code = 'TEST-ROLLBACK-'.Str::random(10);
    $project->project_name = 'Partner ledger transaction fixture';
    $project->quotation_id = null;
    $project->saveQuietly();
    $quote = Quotation::create(['quotation_code' => $project->project_code.'.Q001', 'project_id' => $project->id,
        'lead_id' => Quotation::firstOrFail()->lead_id, 'customer_id' => $project->customer_id, 'service_id' => $project->service_id,
        'subtotal_amount' => 10000000, 'vat_amount' => 800000, 'total_amount' => 10800000, 'deposit_amount' => 0,
        'metadata' => ['projectType' => 'O', 'budget' => 0], 'status' => 'draft']);
    QuotationItem::create(['quotation_id' => $quote->id, 'item_code' => 'FL', 'item_name' => 'Service fixture',
        'quantity' => 1, 'unit_price' => 10000000, 'amount_before_vat' => 10000000, 'vat_amount' => 800000,
        'vat_rate' => 8, 'amount_after_vat' => 10800000, 'sort_order' => 0]);
    $cost = ProjectCost::create(['project_id' => $project->id, 'quotation_id' => $quote->id, 'entry_type' => 'partner_cost',
        'amount_before_vat' => 7000000, 'total_amount' => 7000000, 'status' => 'pending', 'uses_payment_ledger' => true, 'work_period' => '2026-09-01']);
    $service = app(PartnerFinanceService::class);
    $beforeConfirmation = collect($service->report('2026-09')['rows'])->firstWhere('id', $project->id);
    eq($beforeConfirmation['payable'], 0, 'Unconfirmed estimates are not confirmed debt');
    eq($beforeConfirmation['unconfirmedPayable'], 7000000, 'Unconfirmed obligation remains available for review');
    $confirm = fn ($amount, $revision = 0) => ['allocations' => [['period' => '2026-09', 'amount' => $amount]], 'revision' => $revision, 'reason' => 'Fixture confirmation'];
    $r = $service->confirm('revenue', $quote->id, $confirm(10000000));
    eq($r['amount'], 10000000, 'Revenue excludes VAT and does not require cash receipt');
    $c = $service->confirm('cost', $cost->id, $confirm(7000000));
    $row = fn ($period) => collect($service->report($period)['rows'])->firstWhere('id', $project->id);
    eq($row('2026-09')['profit'], 3000000, 'September profit before payment');
    eq($row('2026-09')['payable'], 7000000, 'Confirmed unpaid obligation');
    eq($row('2026-10')['profit'], 0, 'October has no September expense');
    $request = ['requestId' => (string) Str::uuid(), 'paidOn' => '2026-10-02', 'amount' => 3000000, 'note' => 'Partial payment fixture'];
    $p = $service->pay($cost->id, $request);
    eq($service->pay($cost->id, $request)['id'], $p['id'], 'Idempotent repeat');
    eq($row('2026-10')['paidInPeriod'], 3000000, 'October partial cash payment');
    eq($row('2026-09')['profit'], 3000000, 'Payment does not change September profit');
    eq($row('2026-10')['payable'], 4000000, 'Remaining obligation');
    rejects(fn () => $service->pay($cost->id, array_merge($request, ['amount' => 4000000])), 'Request key reuse with different amount');
    rejects(fn () => $service->pay($cost->id, array_merge($request, ['requestId' => (string) Str::uuid(), 'amount' => 4000000.01])), 'Overpayment');
    rejects(fn () => $service->confirm('cost', $cost->id, $confirm(7000000)), 'Stale revision');
    rejects(fn () => PartnerFinance::allocations([['period' => '2026-09', 'amount' => 5], ['period' => '2026-09', 'amount' => 5]], 10), 'Duplicate periods');
    rejects(fn () => PartnerFinance::allocations([['period' => '2026-09', 'amount' => 9.99]], 10), 'Missing cents');
    rejects(fn () => app(ProjectCostsService::class)->update((string) $cost->id, ['status' => 'completed']), 'No legacy status bypass');
    $service->period('2026-09', true, 'Lock fixture');
    rejects(fn () => $service->confirm('cost', $cost->id, $confirm(7000000, $c['revision'])), 'Locked recognition');
    rejects(fn () => $service->unconfirm('revenue', $quote->id, ['revision' => $r['revision'], 'reason' => 'Remove fixture']), 'Locked unconfirm');
    $p2 = $service->pay($cost->id, array_merge($request, ['requestId' => (string) Str::uuid(), 'amount' => 4000000]));
    eq($cost->fresh()->status, 'completed', 'Payment of locked September work allowed in October');
    eq($row('2026-10')['paidInPeriod'], 7000000, 'Cash ledger totals both instalments');
    $service->period('2026-10', true, 'Lock cash fixture');
    rejects(fn () => $service->voidPayment($cost->id, $p2['id'], 'Void fixture'), 'Locked cash reversal');
    $service->period('2026-10', false, 'Reopen fixture');
    $service->voidPayment($cost->id, $p2['id'], 'Correct duplicate record fixture');
    eq($cost->fresh()->status, 'pending', 'Reversal returns to partly paid');
    eq($row('2026-10')['payable'], 4000000, 'Reversal restores payable');
    eq($row('2026-09')['profit'], 3000000, 'Reversal leaves recognition unchanged');
    $legacy = ProjectCost::create(['project_id' => $project->id, 'entry_type' => 'partner_cost', 'amount_before_vat' => 100,
        'total_amount' => 100, 'status' => 'completed', 'transaction_date' => '2026-10-03']);
    $service->period('2026-09', false, 'Reopen work fixture');
    $l = $service->confirm('cost', $legacy->id, $confirm(100));
    eq($legacy->fresh()->partnerPaidAmount(), 100, 'Legacy paid baseline imported once');
    $service->confirm('cost', $legacy->id, $confirm(100, $l['revision']));
    eq(PartnerCostPayment::where('project_cost_id', $legacy->id)->count(), 1, 'Legacy baseline not duplicated');
    eq($legacy->fresh()->transaction_date->toDateString(), '2026-10-03', 'Original bank date preserved');
    eq(collect($service->history('cost', $cost->id))->count() >= 4, true, 'Audit trail exists');
    $multi = $service->confirm('cost', $cost->id, ['revision' => $c['revision'], 'reason' => 'Allocate work across months',
        'allocations' => [['period' => '2026-09', 'amount' => 5000000], ['period' => '2026-10', 'amount' => 2000000]]]);
    eq($row('2026-09')['cost'], 5000100, 'Multiple work periods: September');
    eq($row('2026-10')['cost'], 2000000, 'Multiple work periods: October');
    $service->unconfirm('cost', $cost->id, ['revision' => $multi['revision'], 'reason' => 'Correct work breakdown']);
    eq($cost->fresh()->partnerPaidAmount(), 3000000, 'Unconfirm preserves all cash records');
    rejects(fn () => app(ProjectCostsService::class)->update((string) $cost->id, ['amountBeforeVat' => 2000000]), 'Cannot lower total below paid');
    $new = $service->confirm('cost', $cost->id, $confirm(7000000));
    eq($new['revision'] > $multi['revision'], true, 'Versions do not reset after unconfirm');
    rejects(fn () => $service->confirm('cost', $cost->id, $confirm(7000000, $c['revision'])), 'Old tab cannot overwrite restored recognition');
    rejects(fn () => app(\App\Services\ProjectsService::class)->remove((string) $project->id), 'Cannot remove ledger project');
    eq(PartnerFinance::allocations([['period' => '2026-10', 'amount' => 0]], 0)[0]['amount'], 0, 'Explicit zero revenue can be reconciled');
    $stranger = new User(['role' => 'EMPLOYEE']); $stranger->id = -999999;
    Auth::setUser($stranger); request()->setUserResolver(fn () => $stranger);
    eq(count($service->report('2026-09')['rows']), 0, 'No out-of-scope financial rows');
    try { $service->confirm('cost', $cost->id, $confirm(7000000, $new['revision'])); throw new RuntimeException('Unauthorized confirmation accepted'); }
    catch (\Illuminate\Auth\Access\AuthorizationException $e) { $checks++; }
    Auth::setUser($admin); request()->setUserResolver(fn () => $admin);
    $partner = \App\Models\Option::where('group', 'project_partner')->firstOrFail();
    $cost->refresh()->update(['partner_option_id' => $partner->id]);
    $other = ProjectCost::create(['project_id' => $project->id, 'partner_option_id' => $partner->id, 'entry_type' => 'partner_cost',
        'amount_before_vat' => 1000, 'total_amount' => 1000, 'status' => 'pending', 'uses_payment_ledger' => true]);
    $service->confirm('cost', $other->id, $confirm(1000));
    $batch = ['requestId' => (string) Str::uuid(), 'paidOn' => '2026-10-04', 'note' => 'Combined transfer fixture',
        'allocations' => [['costId' => $cost->id, 'amount' => 1000], ['costId' => $other->id, 'amount' => 1001]]];
    rejects(fn () => $service->payBatch($batch), 'Batch overpayment rolls back all allocations');
    eq($cost->fresh()->partnerPaidAmount(), 3000000, 'No first partial payment after failed batch');
    $batch['allocations'][1]['amount'] = 1000;
    $result = $service->payBatch($batch);
    eq(count($result['ids']), 2, 'Single transfer allocated to two costs');
    eq($service->payBatch($batch)['ids'], $result['ids'], 'Batch retry idempotent');
    $batch['allocations'][0]['amount'] = 2000;
    rejects(fn () => $service->payBatch($batch), 'Batch request cannot be reused with changed contents');
    echo "PASS: $checks partner finance checks; all fixtures rolled back.\n";
} finally { DB::rollBack(); }
