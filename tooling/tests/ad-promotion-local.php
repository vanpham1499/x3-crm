<?php
// Local-only transactional regression. No real customer/card records are changed.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
set_exception_handler(function (Throwable $e): void { fwrite(STDERR, (string) $e); exit(1); });
if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.host') !== '127.0.0.1'
    || (string) config('database.connections.pgsql.port') !== '5433') throw new RuntimeException('Local DB only');
if (in_array('--migrate', $argv, true)) {
    $code = $kernel->call('migrate', ['--path' => 'database/migrations/2026_10_13_000500_add_ad_promotion_source.php', '--force' => true]);
    echo $kernel->output(); exit($code);
}
use App\Models\{User, Project, ProjectCost};
use App\Services\ProjectCostsService;
use App\Support\{AdPromotion, ProjectTopupBudgetCalculator};
use Illuminate\Support\Facades\{Auth, DB};
use Illuminate\Validation\ValidationException;

$checks = 0;
function eq($a,$b,$label) { global $checks; if (is_numeric($a)&&is_numeric($b) ? abs($a-$b)>0.005 : $a!==$b) throw new RuntimeException($label.': '.json_encode([$a,$b])); $checks++; }
function rejects($fn,$label) { global $checks; try {$fn();} catch (ValidationException $e) {$checks++;return;} throw new RuntimeException('Expected rejection: '.$label); }
DB::beginTransaction();
try {
    DB::select('SELECT pg_advisory_xact_lock(88124019)');
    $admin = User::where('role','ADMIN')->firstOrFail(); Auth::setUser($admin); request()->setUserResolver(fn()=>$admin);
    $project = Project::firstOrFail()->replicate(); $project->project_code = 'MKM-ROLLBACK-'.bin2hex(random_bytes(5)); $project->quotation_id=null; $project->saveQuietly();
    $service = app(ProjectCostsService::class);
    $data = ['projectId'=>$project->id,'entryType'=>'ad_spend','fundingSource'=>'promotion','cid'=>'TEST-'.bin2hex(random_bytes(4)),
        'promotionCode'=>'WELCOME-3M','amountBeforeVat'=>3000000,'transactionDate'=>now()->toDateString(),
        'promotionExpiresOn'=>now()->addMonth()->toDateString(), 'promotionEvidenceUrl'=>'/uploads/fixtures/mkm-proof.png'];
    $rules = (new App\Http\Requests\ProjectCosts\CreateProjectCostRequest)->rules();
    eq(validator(['promotionEvidenceUrl'=>$data['promotionEvidenceUrl']], ['promotionEvidenceUrl'=>$rules['promotionEvidenceUrl']])->passes(), true, 'Uploaded relative URL accepted');
    eq(validator(['promotionEvidenceUrl'=>'javascript:alert(1)'], ['promotionEvidenceUrl'=>$rules['promotionEvidenceUrl']])->fails(), true, 'Unsafe evidence URL rejected');
    $response = $service->create($data);
    $cost = ProjectCost::where('project_id',$project->id)->firstOrFail();
    eq($cost->status,'pending','Grant starts pending'); eq($cost->promotionAvailableAmount(),0,'Pending credit not available');
    $service->update((string)$cost->id,['status'=>'completed']); $cost->refresh();
    eq($cost->promotionAvailableAmount(),3000000,'Confirmed grant is available');
    eq($cost->cashOutAmount(),0,'No cash payment'); eq($cost->actualCostAmount(),0,'No cash budget consumption'); eq($cost->realizedCostAmount(),0,'No profit expense');
    eq($cost->bank_account_option_id,null,'No fake bank card');
    $budget=ProjectTopupBudgetCalculator::calculate($project->fresh());
    eq($budget['usedBudget'],0,'Promo cannot consume cash topup limit'); eq($budget['releasedBudget'],0,'Promo cannot create cash topup limit');
    eq($budget['promotionGranted'],3000000,'Separate grant ledger');
    $service->update((string)$cost->id,['promotionUsedAmount'=>1000000,'promotionRevokedAmount'=>500000]); $cost->refresh();
    eq($cost->promotionAvailableAmount(),1500000,'Usage and revocation reduce only promo');
    eq($cost->cashOutAmount(),0,'Usage is not cash');
    rejects(fn()=>$service->update((string)$cost->id,['promotionUsedAmount'=>2800000]),'Cannot exceed grant');
    rejects(fn()=>$service->update((string)$cost->id,['promotionUsedAmount'=>0]),'Cannot silently undo usage');
    rejects(fn()=>$service->update((string)$cost->id,['fundingSource'=>'cash']),'Cannot convert promo to cash');
    rejects(fn()=>$service->update((string)$cost->id,['cidIsDead'=>true,'cidRefundedAmount'=>100000]),'Cannot cash refund promotional grant');
    rejects(fn()=>$service->update((string)$cost->id,['status'=>'cancelled']),'Preserve used grant history');
    rejects(fn()=>$service->create($data),'Duplicate code and CID');
    rejects(fn()=>$service->create(array_merge($data,['cid'=>'OTHER','promotionUsedAmount'=>1,'status'=>'completed'])),'Create cannot bypass pending');
    $cost->promotion_expires_on=now()->subDay(); eq($cost->promotionAvailableAmount(),0,'Expired credit unavailable');
    eq((float)$cost->promotion_used_amount,1000000,'Expiry retains historical usage');
    eq(count($cost->promotion_history)>=3,true,'Audit tracks creation approval and use');
    $cost->refresh();
    $service->update((string)$cost->id,['promotionEvidenceUrl'=>'/uploads/fixtures/mkm-proof-new.png']);
    $oldImage = new App\Models\Attachment(['file_url'=>'/uploads/fixtures/mkm-proof.png']);
    $media = app(App\Services\MediaService::class);
    (new ReflectionMethod($media, 'attachUsageMetadata'))->invoke($media, collect([$oldImage]));
    eq($oldImage->getRelation('mediaUsages')->contains('type','ad_promotion'), true, 'Historic evidence remains protected after replacement');
    $legacy=ProjectCost::create(['project_id'=>$project->id,'entry_type'=>'ad_spend','status'=>'completed','total_amount'=>3000000]);
    eq($legacy->actualCostAmount(),3000000,'Legacy cash unaffected');
    $cost->refresh();
    $budget=ProjectTopupBudgetCalculator::calculate($project->fresh());
    eq($budget['usedBudget'],3000000,'3m cash plus 3m promo counts only 3m cash');
    $legacy->delete();
    $missing=$data; $missing['cid']='NO-EVIDENCE'; $missing['promotionEvidenceUrl']=null;
    $service->create($missing); $empty=ProjectCost::where('cid','NO-EVIDENCE')->firstOrFail();
    rejects(fn()=>$service->update((string)$empty->id,['status'=>'completed']),'Approval needs evidence');
    $stranger=new User(['role'=>'EMPLOYEE']);$stranger->id=-999999; Auth::setUser($stranger);request()->setUserResolver(fn()=>$stranger);
    try {$service->update((string)$cost->id,['promotionUsedAmount'=>1100000]);throw new RuntimeException('Unauthorized update');}
    catch (\Illuminate\Auth\Access\AuthorizationException $e) {$checks++;}
    echo "PASS: $checks ad promotion checks; all fixtures rolled back.\n";
} finally { DB::rollBack(); }
