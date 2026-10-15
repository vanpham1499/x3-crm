<?php

require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $e): void { fwrite(STDERR, (string) $e); exit(1); });
if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.host') !== '127.0.0.1'
    || (string) config('database.connections.pgsql.port') !== '5433') throw new RuntimeException('Local DB 127.0.0.1:5433 only');

use App\Models\{User, Project, ProjectCost, Quotation, QuotationItem, PartnerFinanceRecognition};
use App\Services\{DashboardFinanceService, PartnerFinanceService};
use Carbon\CarbonImmutable as Date;
use Illuminate\Support\Facades\{DB, Auth};
use Illuminate\Support\Str;

$checks = 0;
function checkFinanceLocal($a, $b, string $label): void {
    global $checks;
    if (is_numeric($a) && is_numeric($b) ? abs($a - $b) > 0.01 : $a !== $b) throw new RuntimeException($label.': '.json_encode([$a, $b]));
    $checks++;
}
DB::beginTransaction();
try {
    $admin = User::where('role', 'ADMIN')->firstOrFail();
    Auth::setUser($admin); request()->setUserResolver(fn () => $admin);
    $project = Project::firstOrFail()->replicate();
    $project->project_code = 'FINANCE-ROLLBACK-'.Str::random(10);
    $project->quotation_id = null; $project->saveQuietly();
    $quote = Quotation::create(['quotation_code' => $project->project_code.'.Q001', 'project_id' => $project->id,
        'lead_id' => Quotation::firstOrFail()->lead_id, 'customer_id' => $project->customer_id, 'service_id' => $project->service_id,
        'subtotal_amount' => 36000000, 'vat_amount' => 0, 'total_amount' => 36000000, 'deposit_amount' => 0,
        'metadata' => ['projectType' => 'M', 'budget' => 30000000], 'status' => 'draft', 'created_at' => '2026-09-01']);
    foreach ([['-1', 30000000], ['-2', 6000000]] as [$code, $amount]) {
        QuotationItem::create(['quotation_id' => $quote->id, 'item_code' => $code, 'item_name' => 'Fixture',
            'quantity' => 1, 'unit_price' => $amount, 'amount_before_vat' => $amount, 'vat_amount' => 0, 'vat_rate' => 0,
            'amount_after_vat' => $amount, 'sort_order' => 0]);
    }
    $finance = app(DashboardFinanceService::class);
    $period = fn ($month) => $finance->profit(Date::parse($month.'-01'), Date::parse($month.'-01'), collect([$project]));
    checkFinanceLocal(count($period('2026-10')['review']), 1, 'Unconfirmed revenue visible');
    $list = app(PartnerFinanceService::class)->report('2026-09');
    checkFinanceLocal(collect($list['rows'])->contains('id', $project->id), true, 'Can confirm revenue without partner costs');
    PartnerFinanceRecognition::create(['project_id' => $project->id, 'entity_type' => 'revenue', 'entity_id' => $quote->id,
        'amount' => 6000000, 'allocations' => [['period' => '2026-09', 'amount' => 6000000]], 'revision' => 1,
        'confirmed_by' => $admin->id]);
    $cost = ProjectCost::create(['project_id' => $project->id, 'entry_type' => 'partner_cost',
        'total_amount' => 2000000, 'status' => 'pending', 'work_period' => '2026-09-01']);
    PartnerFinanceRecognition::create(['project_id' => $project->id, 'entity_type' => 'cost', 'entity_id' => $cost->id,
        'amount' => 2000000, 'allocations' => [['period' => '2026-09', 'amount' => 2000000]], 'revision' => 1,
        'confirmed_by' => $admin->id]);
    checkFinanceLocal($period('2026-09')['profit'], 4000000, 'Excludes budget before any payment');
    $cost->update(['status' => 'completed', 'transaction_date' => '2026-10-02']);
    checkFinanceLocal($period('2026-09')['profit'], 4000000, 'Late payment does not move recognized expense');
    checkFinanceLocal($period('2026-10')['cost'], 0, 'October payment is not a second expense');
    ProjectCost::create(['project_id' => $project->id, 'entry_type' => 'ad_spend', 'total_amount' => 30000000,
        'status' => 'completed', 'transaction_date' => '2026-09-02']);
    ProjectCost::create(['project_id' => $project->id, 'entry_type' => 'ad_spend', 'funding_source' => 'promotion',
        'total_amount' => 3000000, 'status' => 'completed', 'transaction_date' => '2026-09-03']);
    checkFinanceLocal($period('2026-09')['profit'], 4000000, 'No double subtraction for topup or MKM');
    $cost->update(['total_amount' => 2100000]);
    checkFinanceLocal(count($period('2026-09')['review']), 1, 'Changed source is flagged');
    checkFinanceLocal($period('2026-09')['comparable'], false, 'Stale ledger blocks growth claim');
    checkFinanceLocal($finance->profit(Date::parse('2026-09-01'), Date::parse('2026-09-01'), collect())['details'], [], 'Empty scope cannot leak entries');
    echo "$checks local dashboard finance checks passed; fixtures rolled back\n";
} finally {
    DB::rollBack();
}
