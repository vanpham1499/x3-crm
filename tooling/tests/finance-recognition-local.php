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
        'lead_id' => Quotation::firstOrFail()->lead_id, 'customer_id' => $project->customer_id, 'service_id' => $project->service_id, 'service_code' => 'DV1',
        'subtotal_amount' => 7000000, 'vat_amount' => 0, 'total_amount' => 7000000, 'deposit_amount' => 0,
        'metadata' => ['projectType' => 'M'], 'status' => 'draft']);
    foreach ([['-1',6000000],['-2',1000000]] as [$code,$amount]) QuotationItem::create(['quotation_id'=>$quote->id,
        'item_code'=>$code,'item_name'=>'Fixture','quantity'=>1,'unit_price'=>$amount,'amount_before_vat'=>$amount,'amount_after_vat'=>$amount,'vat_amount'=>0]);
    $cost = ProjectCost::create(['project_id'=>$project->id,'quotation_id'=>$quote->id,'entry_type'=>'partner_cost',
        'total_amount'=>200000,'amount_before_vat'=>200000,'status'=>'pending','work_period'=>'2026-09-01','uses_payment_ledger'=>true]);
    $topup = ProjectCost::create(['project_id'=>$project->id,'quotation_id'=>$quote->id,'entry_type'=>'ad_spend',
        'total_amount'=>3000000,'status'=>'completed','transaction_date'=>'2026-09-30']);
    $read = fn () => collect($service->report('2026-09', [$project->id])['rows'])->firstWhere('id',$project->id);
    $q = fn () => collect($read()['quotations'])->firstWhere('id',$quote->id);
    eq($q()['suggestion']['status'],'waiting','Partial budget is not ready');
    $promotion = $topup->replicate(); $promotion->funding_source='promotion'; $promotion->saveQuietly();
    eq($q()['suggestion']['status'],'waiting','MKM does not count toward cash top-up');
    $topup2=$topup->replicate(); $topup2->transaction_date='2026-10-01'; $topup2->saveQuietly();
    $suggestion=$q()['suggestion'];
    eq($suggestion['status'],'ready','Fully topped up quotation is ready');
    eq($suggestion['allocations'],[['period'=>'2026-10','amount'=>1000000.0]],'Whole fee belongs to the month budget becomes fully topped up');
    $costRow=collect($read()['costs'])->firstWhere('id',$cost->id);
    eq($costRow['suggestion']['allocations'][0]['period'],'2026-09','Unpaid partner expense uses work month');
    $cost->update(['work_period'=>'2026-10-01']);
    $costRow=collect($read()['costs'])->firstWhere('id',$cost->id);
    $items=[['type'=>'revenue','id'=>$quote->id,'fingerprint'=>$suggestion['fingerprint']],['type'=>'cost','id'=>$cost->id,'fingerprint'=>$costRow['suggestion']['fingerprint']]];
    $batch=['requestId'=>(string)Str::uuid(),'period'=>'2026-10','items'=>$items];
    $cost->update(['work_period'=>'2026-09-01']);
    rejects(fn ()=>$service->confirmBatch($batch),'Changed work month rejects entire batch');
    eq(DB::table('partner_finance_recognitions')->where('project_id',$project->id)->count(),0,'No partial write after stale batch');
    $cost->update(['work_period'=>'2026-10-01']);
    $row=$read(); $batch['items'][1]['fingerprint']=collect($row['costs'])->firstWhere('id',$cost->id)['suggestion']['fingerprint'];
    $service->period('2026-10',true,'Lock fixture');
    rejects(fn ()=>$service->confirmBatch($batch),'Completion month is locked; reject');
    $service->period('2026-10',false,'Unlock fixture');
    $row=$read(); $batch['items'][0]['fingerprint']=collect($row['quotations'])->firstWhere('id',$quote->id)['suggestion']['fingerprint'];
    $batch['items'][1]['fingerprint']=collect($row['costs'])->firstWhere('id',$cost->id)['suggestion']['fingerprint'];
    $stranger=new User(['role'=>'EMPLOYEE']); $stranger->id=-99999; Auth::setUser($stranger);
    try {$service->confirmBatch($batch);throw new RuntimeException('Permission bypass');} catch (Illuminate\Auth\Access\AuthorizationException|Symfony\Component\HttpKernel\Exception\HttpException $e) {$checks++;}
    Auth::setUser($admin);
    $result=$service->confirmBatch($batch); eq($result['count'],2,'Batch confirms both sources');
    eq($service->confirmBatch($batch)['count'],2,'Retry is idempotent');
    eq(DB::table('partner_finance_recognitions')->where('project_id',$project->id)->count(),2,'No duplicate recognition');
    eq(DB::table('partner_finance_audits')->where('entity_type','recognition_batch')->where('entity_id',substr(hash('sha256',$batch['requestId']),0,30))->value('reason'),'Xác nhận hàng loạt theo kỳ đề xuất','Batch without reason keeps an audit explanation');
    $recognized=$q()['recognition'];
    rejects(fn ()=>$service->confirm('revenue',$quote->id,['revision'=>$recognized['revision'],'allocations'=>$recognized['allocations']]),'Adjusting a confirmed period still requires a reason');
    eq($read()['profit'],0,'No revenue spread backward into September');
    eq($service->report('2026-10', [$project->id])['rows'][0]['profit'],800000,'October full fee less work cost');
    $batch['reason']='Different payload'; rejects(fn ()=>$service->confirmBatch($batch),'Request key cannot change payload');
    $service->pay($cost->id,['requestId'=>(string)Str::uuid(),'paidOn'=>'2026-10-02','amount'=>200000,'note'=>'Fixture payment']);
    eq($service->report('2026-10', [$project->id])['rows'][0]['profit'],800000,'Payment does not double deduct recognized cost');
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

    // DV3 completion is independent of cash collection and partner payment dates.
    $dv3 = $quote->replicate(); $dv3->quotation_code = $project->project_code.'.DV3'; $dv3->service_code='DV3.W'; $dv3->saveQuietly();
    $dv3->setRelation('items',collect()); $dv3->setRelation('paymentRefunds',collect()); $dv3->setRelation('paymentAllocations',collect());
    eq(App\Support\FinanceRecognitionSuggestion::revenue($dv3,1000000,collect(),collect())['status'],'review','DV3 requires staff completion even when paid to partner');
    $completion=app(App\Services\QuotationCompletionService::class);
    $completion->update($dv3->id,['period'=>'2026-09','expectedPeriod'=>null]);
    rejects(fn ()=>$completion->update($dv3->id,['period'=>'2026-10','expectedPeriod'=>'2026-09']), 'Changing completion still requires a reason');
    $dv3->refresh();
    $proposal=App\Support\FinanceRecognitionSuggestion::revenue($dv3,1000000,collect(),collect());
    eq($proposal['allocations'],[['period'=>'2026-09','amount'=>1000000.0]],'DV3 recognizes completed work despite zero receipts');
    rejects(fn ()=>$completion->update($dv3->id,['period'=>'2026-10','expectedPeriod'=>null,'reason'=>'Stale update']), 'Completion concurrency guard');
    rejects(fn ()=>$completion->update($dv3->id,['period'=>'2099-10','expectedPeriod'=>'2026-09','reason'=>'Future update']), 'Future completion blocked');
    $service->period('2026-09',true,'Lock fixture completion');
    rejects(fn ()=>$completion->update($dv3->id,['period'=>'2026-10','expectedPeriod'=>'2026-09','reason'=>'Locked update']), 'Locked completion blocked');
    $service->period('2026-09',false,'Unlock fixture completion');
    Auth::setUser($stranger);
    try {$completion->update($dv3->id,['period'=>'2026-10','expectedPeriod'=>'2026-09','reason'=>'Forbidden update']); throw new RuntimeException('Completion permission bypass');}
    catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {eq($e->getStatusCode(),403,'Unrelated staff cannot change completion');}
    Auth::setUser($admin);

    // Page boundaries apply in SQL, with no nested source arrays in the list response.
    $reader=app(App\Services\PartnerFinanceReadService::class);
    $prefix='PAGING-'.Str::random(8);
    $seed=$project->getAttributes(); unset($seed['id']);
    $fixtures=[];
    for($i=0;$i<1005;$i++) {$row=$seed; $row['project_code']=$prefix.'-'.str_pad((string)$i,4,'0',STR_PAD_LEFT); $fixtures[]=$row;}
    foreach(array_chunk($fixtures,100) as $chunk) DB::table('projects')->insert($chunk);
    $filters=['period'=>'2026-10','keyword'=>$prefix,'per_page'=>10,'page'=>1];
    DB::enableQueryLog();
    $first=$reader->page($filters);
    $sql=collect(DB::getQueryLog())->pluck('query'); DB::disableQueryLog(); DB::flushQueryLog();
    eq($first['pagination']['total'],1005,'API count spans all 1005 projects');
    eq(count($first['rows']),10,'API returns only ten project summaries');
    eq(isset($first['rows'][0]['quotations']),false,'List omits quotations');
    eq(isset($first['rows'][0]['costs']),false,'List omits costs/payment histories');
    eq($sql->contains(fn($q)=>str_contains($q,'limit 10 offset 0')),true,'Pagination is applied by database');
    $second=$reader->page(array_replace($filters,['page'=>2]));
    eq(count(array_intersect(array_column($first['rows'],'id'),array_column($second['rows'],'id'))),0,'Adjacent pages have no duplicate projects');
    eq(count($reader->page(array_replace($filters,['page'=>101]))['rows']),5,'Last page contains remaining five');
    eq(count($reader->page(array_replace($filters,['page'=>102]))['rows']),0,'Out of range page is empty');
    eq(count($reader->page(array_replace($filters,['per_page'=>20]))['rows']),20,'Page size is honored');
    $detail=$reader->detail($project->id,'2026-10');
    eq($detail['id'],$project->id,'Detail loads requested project');
    eq(count($detail['quotations'])>=2,true,'Detail includes sources separately');
    $summary=$reader->summary(['period'=>'2026-10','keyword'=>$project->project_code]);
    eq($summary['totals']['profit'],800000,'Summary covers full filter independently of page');
    $queue=$reader->suggestions(['period'=>'2026-10','keyword'=>$project->project_code,'status'=>'ready','per_page'=>10,'page'=>1]);
    eq(count($queue['rows']),0,'Confirmed sources excluded from ready queue');
    for ($i=0;$i<12;$i++) {
        $queued=$dv3->replicate(); $queued->quotation_code=$project->project_code.'.QUEUE'.$i;
        $queued->subtotal_amount=1000000; $queued->total_amount=1000000;
        $queued->work_completed_period='2026-10-01'; $queued->saveQuietly();
        QuotationItem::create(['quotation_id'=>$queued->id,'item_code'=>'-2','item_name'=>'Fixture service','quantity'=>1,
            'unit_price'=>1000000,'amount_before_vat'=>1000000,'amount_after_vat'=>1000000,'vat_amount'=>0]);
    }
    $queueFilters=['period'=>'2026-10','keyword'=>$project->project_code,'status'=>'ready','per_page'=>10,'page'=>1];
    $queue1=$reader->suggestions($queueFilters); $queue2=$reader->suggestions(array_replace($queueFilters,['page'=>2]));
    eq($queue1['pagination']['total'],12,'Queue total covers eligible sources across pages');
    eq(count($queue1['rows']),10,'Queue page one bounded'); eq(count($queue2['rows']),2,'Queue page two bounded');
    eq(count(array_intersect(array_column($queue1['rows'],'key'),array_column($queue2['rows'],'key'))),0,'Queue pages have no duplicate sources');
    $queueSummary=$reader->summary(['period'=>'2026-10','keyword'=>$project->project_code]);
    eq($queueSummary['counts']['ready'],12,'Queue badge total agrees with API pagination');
    $selection=$reader->selection(array_replace($queueFilters,['page'=>2,'status'=>'review']));
    eq(count($selection['rows']),12,'Select all crosses pages and ignores client status');
    eq(count(array_diff(array_merge(array_column($queue1['rows'],'key'),array_column($queue2['rows'],'key')),array_column($selection['rows'],'key'))),0,'Select all includes both pages');
    eq(count(array_filter($selection['rows'],fn($r)=>!$r['canConfirm'] || $r['suggestion']['status']!=='ready')),0,'Select all includes only permitted ready sources');
    $one=$queue1['rows'][0];
    $service->confirmBatch(['requestId'=>(string)Str::uuid(),'period'=>'2026-10','reason'=>'Fixture one selected source',
        'items'=>[['type'=>$one['type'],'id'=>$one['id'],'fingerprint'=>$one['suggestion']['fingerprint']]]]);
    rejects(fn ()=>$completion->update($one['id'],['period'=>'2026-09','expectedPeriod'=>'2026-10','reason'=>'Change confirmed source']), 'Confirmed source completion protected');
    eq($reader->suggestions($queueFilters)['pagination']['total'],11,'Confirmed source leaves queue');
    $single=$queue2['rows'][0];
    $saved=$service->confirm($single['type'],$single['id'],['revision'=>0,'allocations'=>$single['suggestion']['allocations']]);
    eq($saved['amount'],1000000,'First individual confirmation needs no typed reason');
    $seedQuote=$queued->getAttributes(); unset($seedQuote['id']);
    $more=[];
    for($i=0;$i<491;$i++) {$row=$seedQuote; $row['quotation_code']=$project->project_code.'.CAP'.$i; $more[]=$row;}
    foreach(array_chunk($more,100) as $chunk) DB::table('quotations')->insert($chunk);
    $newIds=DB::table('quotations')->where('quotation_code','like',$project->project_code.'.CAP%')->pluck('id');
    $items=[];
    foreach($newIds as $id) $items[]=['quotation_id'=>$id,'item_code'=>'-2','item_name'=>'Fixture service','quantity'=>1,'unit_price'=>1000000,'amount_before_vat'=>1000000,'amount_after_vat'=>1000000,'vat_amount'=>0];
    foreach(array_chunk($items,100) as $chunk) DB::table('quotation_items')->insert($chunk);
    $capped=$reader->selection($queueFilters);
    eq($capped['total'],501,'Selection reports eligible total beyond its cap');
    eq(count($capped['rows']),500,'Cross-page selection is bounded to 500');
    Auth::setUser($stranger);
    eq($reader->selection($queueFilters)['total'],0,'Cross-page selection excludes inaccessible sources');
    eq($reader->page($filters)['pagination']['total'],0,'List and counts respect visibility');
    try {$reader->detail($project->id,'2026-10'); throw new RuntimeException('Detail permission bypass');}
    catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {eq($e->getStatusCode(),403,'Detail denies inaccessible project');}
    Auth::setUser($admin);

    echo "PASS: $checks recognition suggestion/batch checks; all fixtures rolled back.\n";
} finally {DB::rollBack();}
