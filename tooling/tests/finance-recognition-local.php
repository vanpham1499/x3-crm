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
    Illuminate\Support\Facades\Event::fake();
    $admin = User::where('role', 'ADMIN')->firstOrFail();
    Auth::setUser($admin); request()->setUserResolver(fn () => $admin);
    DB::table('partner_finance_periods')->whereIn('period', ['2026-09', '2026-10'])->delete();
    $project = Project::firstOrFail()->replicate(); $project->project_code = 'SUGGEST-'.Str::random(10);
    $project->quotation_id = null; $project->saveQuietly();
    $service = app(PartnerFinanceService::class);
    $quote = Quotation::create(['quotation_code' => $project->project_code.'.Q001', 'project_id' => $project->id,
        'lead_id' => Quotation::firstOrFail()->lead_id, 'customer_id' => $project->customer_id, 'service_id' => $project->service_id,
        'subtotal_amount' => 7000000, 'vat_amount' => 0, 'total_amount' => 7000000, 'deposit_amount' => 0,
        'metadata' => ['projectType' => 'M'], 'status' => 'draft']);
    foreach ([['-1',6000000],['-2',1000000]] as [$code,$amount]) QuotationItem::create(['quotation_id'=>$quote->id,
        'item_code'=>$code,'item_name'=>'Fixture','quantity'=>1,'unit_price'=>$amount,'amount_before_vat'=>$amount,'amount_after_vat'=>$amount,'vat_amount'=>0]);
    $cost = ProjectCost::create(['project_id'=>$project->id,'quotation_id'=>$quote->id,'entry_type'=>'partner_cost',
        'total_amount'=>200000,'amount_before_vat'=>200000,'status'=>'pending','work_period'=>'2026-09-01','uses_payment_ledger'=>true]);
    $topup = ProjectCost::create(['project_id'=>$project->id,'quotation_id'=>$quote->id,'entry_type'=>'ad_spend',
        'total_amount'=>3000000,'status'=>'completed','transaction_date'=>'2026-09-30']);
    $read = fn () => collect($service->report('2026-09')['rows'])->firstWhere('id',$project->id);
    $q = fn () => collect($read()['quotations'])->firstWhere('id',$quote->id);
    eq($q()['suggestion']['status'],'waiting','Partial budget is not ready');
    $promotion = $topup->replicate(); $promotion->funding_source='promotion'; $promotion->saveQuietly();
    eq($q()['suggestion']['status'],'waiting','MKM does not count toward cash top-up');
    $topup2=$topup->replicate(); $topup2->transaction_date='2026-10-01'; $topup2->saveQuietly();
    $suggestion=$q()['suggestion'];
    eq($suggestion['status'],'ready','Fully topped up quotation is ready');
    eq($suggestion['allocations'],[['period'=>'2026-09','amount'=>500000],['period'=>'2026-10','amount'=>500000]],'Split fee across actual top-up months; no budget revenue');
    $costRow=collect($read()['costs'])->firstWhere('id',$cost->id);
    eq($costRow['suggestion']['allocations'][0]['period'],'2026-09','Unpaid partner expense uses work month');
    $items=[['type'=>'revenue','id'=>$quote->id,'fingerprint'=>$suggestion['fingerprint']],['type'=>'cost','id'=>$cost->id,'fingerprint'=>$costRow['suggestion']['fingerprint']]];
    $batch=['requestId'=>(string)Str::uuid(),'period'=>'2026-09','reason'=>'Fixture batch confirmation','items'=>$items];
    $cost->update(['work_period'=>'2026-10-01']);
    rejects(fn ()=>$service->confirmBatch($batch),'Changed work month rejects entire batch');
    eq(DB::table('partner_finance_recognitions')->where('project_id',$project->id)->count(),0,'No partial write after stale batch');
    $cost->update(['work_period'=>'2026-09-01']);
    $row=$read(); $batch['items'][1]['fingerprint']=collect($row['costs'])->firstWhere('id',$cost->id)['suggestion']['fingerprint'];
    $service->period('2026-10',true,'Lock fixture');
    rejects(fn ()=>$service->confirmBatch($batch),'Split includes locked month; reject');
    $service->period('2026-10',false,'Unlock fixture');
    $row=$read(); $batch['items'][0]['fingerprint']=collect($row['quotations'])->firstWhere('id',$quote->id)['suggestion']['fingerprint'];
    $batch['items'][1]['fingerprint']=collect($row['costs'])->firstWhere('id',$cost->id)['suggestion']['fingerprint'];
    $stranger=new User(['role'=>'EMPLOYEE']); $stranger->id=-99999; Auth::setUser($stranger);
    try {$service->confirmBatch($batch);throw new RuntimeException('Permission bypass');} catch (Illuminate\Auth\Access\AuthorizationException|Symfony\Component\HttpKernel\Exception\HttpException $e) {$checks++;}
    Auth::setUser($admin);
    $result=$service->confirmBatch($batch); eq($result['count'],2,'Batch confirms both sources');
    eq($service->confirmBatch($batch)['count'],2,'Retry is idempotent');
    eq(DB::table('partner_finance_recognitions')->where('project_id',$project->id)->count(),2,'No duplicate recognition');
    eq($read()['profit'],300000,'September profit only includes allocated service fee less work expense');
    $batch['reason']='Different payload'; rejects(fn ()=>$service->confirmBatch($batch),'Request key cannot change payload');
    $service->pay($cost->id,['requestId'=>(string)Str::uuid(),'paidOn'=>'2026-10-02','amount'=>200000,'note'=>'Fixture payment']);
    eq($read()['profit'],300000,'October payment does not move September work');
    $bare=new ProjectCost(['total_amount'=>10,'status'=>'completed','transaction_date'=>'2026-10-01']);
    eq(App\Support\FinanceRecognitionSuggestion::cost($bare)['status'],'review','Old cost without work month is never inferred from payment date');
    $noBudget=new Quotation(['total_amount'=>100,'metadata'=>['projectType'=>'K']]);
    $noBudget->setRelation('items',collect());$noBudget->setRelation('paymentRefunds',collect());
    $receipt=new App\Models\PaymentAllocation(['amount'=>100]);$receipt->setRelation('payment',new App\Models\Payment(['transaction_at'=>'2026-09-30 23:00:00']));
    $noBudget->setRelation('paymentAllocations',collect([$receipt]));
    $fee=App\Support\FinanceRecognitionSuggestion::revenue($noBudget,100,collect(),collect());
    eq($fee['allocations'][0]['period'],'2026-09','Fee-only service uses real receipt month without timezone shift');
    $receipt->amount=50;
    eq(App\Support\FinanceRecognitionSuggestion::revenue($noBudget,100,collect(),collect())['status'],'waiting','Partial fee receipt waits');
    $noBudget->setRelation('paymentRefunds',collect([new App\Models\PaymentRefund(['status'=>'completed'])]));
    eq(App\Support\FinanceRecognitionSuggestion::revenue($noBudget,100,collect(),collect())['status'],'review','Refund requires review');
    $quote->unsetRelation('paymentRefunds');
    $unlinked = new ProjectCost(['total_amount'=>6000000,'entry_type'=>'ad_spend','status'=>'completed','transaction_date'=>'2026-09-01']); $unlinked->setRelation('cidIncident',null);
    $other=$quote->replicate();$other->id=$quote->id+10000; $other->setRelation('items',$quote->items); $other->setRelation('paymentRefunds',collect()); $other->setRelation('paymentAllocations',collect());
    eq(App\Support\FinanceRecognitionSuggestion::revenue($quote,1000000,collect([$unlinked]),collect([$quote,$other]))['status'],'review','Ambiguous unlinked topup cannot choose a quotation');
    eq(App\Support\FinanceRecognitionSuggestion::revenue($quote,1000000,collect([$unlinked]),collect([$quote]))['status'],'ready','Single budget quote can use unlinked topup');
    $unlinked->total_amount=7000000;
    eq(App\Support\FinanceRecognitionSuggestion::revenue($quote,1000000,collect([$unlinked]),collect([$quote]))['status'],'review','Excess linked budget requires review');
    rejects(fn () => app(ProjectCostsService::class)->create(['projectId'=>$project->id,'entryType'=>'partner_cost','amountBeforeVat'=>100]), 'New partner cost requires work month');
    echo "PASS: $checks recognition suggestion/batch checks; all fixtures rolled back.\n";
} finally {DB::rollBack();}
