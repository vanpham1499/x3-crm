<?php
// Local-only integration tests; all fixtures/notifications/audits roll back.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class); $kernel->bootstrap();
set_exception_handler(function (Throwable $e): void { fwrite(STDERR, (string) $e); exit(1); });
if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.host') !== '127.0.0.1' || (string) config('database.connections.pgsql.port') !== '5433') throw new RuntimeException('Local DB only');
if (in_array('--migrate', $argv, true)) {
    $code = $kernel->call('migrate', ['--path'=>'database/migrations/2026_10_13_000600_add_payment_receipt_origin.php','--force'=>true]); echo $kernel->output(); exit($code);
}
use App\Models\{User, Project, Payment, Quotation, QuotationItem};
use App\Services\{PaymentsService, PaymentAllocationService, PaymentRecognitionService};
use App\Support\ProjectTopupBudgetCalculator;
use Illuminate\Support\Facades\{DB, Auth};
use Illuminate\Validation\ValidationException;
$checks=0;
function eq($a,$b,$label) {global $checks; if (is_numeric($a)&&is_numeric($b)?abs($a-$b)>0.005:$a!==$b) throw new RuntimeException($label.': '.json_encode([$a,$b])); $checks++;}
function rejects($fn,$label) {global $checks;try {$fn();}catch(ValidationException $e){$checks++;return;}throw new RuntimeException('Expected rejection: '.$label);}
DB::beginTransaction();
try {
    DB::select('SELECT pg_advisory_xact_lock(88124019)');
    $admin=User::where('role','ADMIN')->firstOrFail(); Auth::setUser($admin);request()->setUserResolver(fn()=>$admin);
    $service=app(PaymentsService::class); $allocationService=app(PaymentAllocationService::class); $recognition=app(PaymentRecognitionService::class);
    $project=Project::where('project_type','K')->firstOrFail()->replicate(); $project->project_code='TEST.RECEIPT.K.'.bin2hex(random_bytes(5));$project->quotation_id=null;$project->manager_user_id=$admin->id;$project->saveQuietly();
    $quote=Quotation::create(['quotation_code'=>$project->project_code.'.Q001','project_id'=>$project->id,'customer_id'=>$project->customer_id,'lead_id'=>Quotation::firstOrFail()->lead_id,'service_id'=>$project->service_id,'subtotal_amount'=>1000000,'vat_amount'=>80000,'total_amount'=>1080000,'deposit_amount'=>0,'metadata'=>['projectType'=>'K'],'status'=>'draft']);
    QuotationItem::create(['quotation_id'=>$quote->id,'item_code'=>'-2','item_name'=>'Management fee','quantity'=>1,'unit_price'=>1000000,'amount_before_vat'=>1000000,'vat_amount'=>80000,'vat_rate'=>8,'amount_after_vat'=>1080000,'sort_order'=>0]);
    $payload=['transactionAt'=>'2026-10-08 13:08:47','amount'=>1080000,'paymentChannel'=>'paypal','bankAccount'=>'test-paypal-account','reference'=>'TEST-'.bin2hex(random_bytes(5)),'platformFeeAmount'=>80000];
    $response=$service->create($payload);$payment=Payment::findOrFail($response['id']);
    eq($payment->payment_channel,'paypal','Manual PayPal channel');eq($response['netReceivedAmount'],1000000,'Net amount');
    rejects(fn()=>$service->create($payload),'Duplicate PayPal reference');
    rejects(fn()=>$service->create(array_merge($payload,['reference'=>''])),'Reference required');
    rejects(fn()=>$service->create(array_merge($payload,['reference'=>'NEW','platformFeeAmount'=>1080001])),'Fee cannot exceed receipt');
    $service->update((string)$payment->id,['note'=>'Read-only date regression']);$payment->refresh();eq($payment->transaction_at->format('Y-m-d H:i:s'),'2026-10-08 13:08:47','Partial update preserves event date');
    $allocationService->allocate($payment->id,[['quotationId'=>$quote->id,'amount'=>1080000]],$admin->id);
    $payment->refresh(); $result=$recognition->describe($payment);$row=$result['rows'][0];
    eq($row['feeAmount'],1000000,'Fee recognized excludes VAT but not PayPal expense');eq($row['period'],'2026-10','Receipt month not entry month');eq($row['implementation']['id'],$admin->id,'Frozen implementation owner');eq($row['projectType'],'K','K classification');
    eq(ProjectTopupBudgetCalculator::calculate($project->fresh())['availableBudget'],0,'K receipt never becomes topup budget');
    rejects(fn()=>$service->update((string)$payment->id,['receiptType'=>'internal','changeReason'=>'Wrong classification']),'Cannot reclassify allocated cash');
    rejects(fn()=>$service->update((string)$payment->id,['transactionAt'=>'2026-09-30']),'Date correction requires reason');
    rejects(fn()=>$service->update((string)$payment->id,['transactionAt'=>'2026-09-30','changeReason'=>'Proof','expectedUpdatedAt'=>'2000-01-01']),'Stale edit rejected');
    $service->update((string)$payment->id,['transactionAt'=>'2026-09-30','changeReason'=>'Actual receipt proof']);
    $row=$recognition->describe($payment->fresh())['rows'][0];eq($row['period'],'2026-09','Correction updates KPI period');eq($row['status'],'legacy','September formula remains legacy');eq(DB::table('payment_receipt_audits')->where('payment_id',$payment->id)->where('reason','Actual receipt proof')->count(),1,'Date correction has audit');
    $transfer=$service->create(['transactionAt'=>'2026-10-12','receiptType'=>'internal','paymentChannel'=>'bank','amount'=>600000,'sourcePaymentId'=>$payment->id]);
    eq($transfer['receiptType'],'internal','Withdrawal internal');eq($transfer['allocatedAmount'],0,'Withdrawal not allocated');eq(count($recognition->describe(Payment::find($transfer['id']))['rows']),0,'Withdrawal no KPI event');
    rejects(fn()=>$allocationService->allocate($transfer['id'],[['quotationId'=>$quote->id,'amount'=>1]],$admin->id),'Cannot allocate withdrawal');
    rejects(fn()=>$service->create(['transactionAt'=>'2026-10-12','receiptType'=>'internal','amount'=>400001,'sourcePaymentId'=>$payment->id]),'Multiple withdrawals bounded by net');
    rejects(fn()=>$service->update((string)$payment->id,['platformFeeAmount'=>500000,'changeReason'=>'Fee update']),'Fee change preserves withdrawals');
    rejects(fn()=>$service->update((string)$transfer['id'],['receiptType'=>'customer','changeReason'=>'Bad type']),'Linked withdrawal cannot become customer revenue');
    rejects(fn()=>$service->update((string)$transfer['id'],['sourcePaymentId'=>$transfer['id'],'changeReason'=>'Cycle']),'No self reference');
    rejects(fn()=>$service->update((string)$transfer['id'],['receiptType'=>'customer','sourcePaymentId'=>null,'changeReason'=>'Unlink and reclassify']),'Cannot turn withdrawal into duplicate revenue in same edit');
    rejects(fn()=>$service->create(['transactionAt'=>'2026-10-12','receiptType'=>'customer','amount'=>10,'sourcePaymentId'=>$payment->id]),'Source link cannot be customer receipt');
    $rules=(new App\Http\Requests\Payments\CreatePaymentRequest)->rules();eq(validator($payload,$rules)->passes(),true,'HTTP schema accepts receipt');
    eq(validator(array_diff_key($payload,['transactionAt'=>1]),$rules)->fails(),true,'Explicit receipt date required');
    $bankReference='BANK-'.bin2hex(random_bytes(5));
    $bank=$service->webhook(['transactionAt'=>'2026-10-01 09:00:00','amount'=>100,'reference'=>$bankReference,'transactionContent'=>'TEST no matching quotation']);
    $service->update((string)$bank['id'],['transactionAt'=>'2026-09-29 10:00:00','changeReason'=>'Receipt proof']);
    $service->webhook(['transactionAt'=>'2026-10-01 09:00:00','amount'=>100,'reference'=>$bankReference,'transactionContent'=>'TEST no matching quotation']);
    eq(Payment::find($bank['id'])->transaction_at->format('Y-m-d H:i:s'),'2026-09-29 10:00:00','Webhook redelivery preserves audited date correction');
    $service->update((string)$bank['id'],['receiptType'=>'internal','sourcePaymentId'=>$payment->id,'changeReason'=>'Matched PayPal withdrawal']);
    $service->webhook(['transactionAt'=>'2026-10-01 09:00:00','amount'=>100,'reference'=>$bankReference,'transactionContent'=>$quote->quotation_code]);
    eq(Payment::find($bank['id'])->receipt_type,'internal','Webhook redelivery preserves withdrawal classification');
    eq(Payment::find($bank['id'])->allocations()->count(),0,'Webhook cannot allocate internal transfer');
    echo "PASS $checks receipt-origin checks; rolled back all fixtures.\n";
} finally {DB::rollBack();}
