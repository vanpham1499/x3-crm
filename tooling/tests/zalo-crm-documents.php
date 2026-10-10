<?php
// Disposable database + fake native transport. Never sends a real Zalo message.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use App\Services\{ZaloCrmDocuments, ZaloCrmDocumentWorker, ZaloTeamCatalog, ZaloTeamCampaignTransport};
use Illuminate\Support\Facades\{DB, Schema, Http};
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

config(['database.default'=>'doc_test','database.connections.doc_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>''],
    'cache.default'=>'array','zalo_team.storage_owner'=>str_repeat('a',64)]);
DB::purge('doc_test');
if (DB::connection()->getDatabaseName() !== ':memory:') throw new Exception('Unsafe test');
Http::preventStrayRequests();
$temp = sys_get_temp_dir().'/x3-doc-test-'.Str::uuid();
mkdir($temp,0700,true); $app->useStoragePath($temp);
register_shutdown_function(function () use ($temp) { foreach (glob($temp.'/app/private/zalo-crm-documents/*') ?: [] as $p) unlink($p); @rmdir($temp.'/app/private/zalo-crm-documents'); @rmdir($temp.'/app/private'); @rmdir($temp.'/app'); @unlink($temp.'/fixture.png'); @rmdir($temp); });
set_exception_handler(function (Throwable $e) { fwrite(STDERR,$e."\n"); exit(1); });
Schema::create('users',function(Blueprint $t){$t->id();$t->string('name');$t->string('role');$t->integer('role_id')->nullable();$t->boolean('is_active')->default(true);$t->integer('department_id')->nullable();$t->softDeletes();$t->timestamps();});
Schema::create('departments',function(Blueprint $t){$t->id();$t->string('name');$t->integer('leader_user_id')->nullable();$t->softDeletes();});
Schema::create('roles',function(Blueprint $t){$t->id();$t->string('name');$t->softDeletes();$t->timestamps();});
Schema::create('permissions',function(Blueprint $t){$t->id();$t->string('code');$t->softDeletes();$t->timestamps();});
Schema::create('role_permissions',function(Blueprint $t){$t->integer('role_id');$t->integer('permission_id');$t->timestamps();});
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_08_000100_create_zalo_access.php')->up();
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_09_000260_create_zalo_crm_deliveries.php')->up();
foreach (['customers','projects','quotations','weekly_reports'] as $table) Schema::create($table,function(Blueprint $t) use($table){
    $t->id();$t->integer('project_id')->nullable();$t->integer('customer_id')->nullable();$t->integer('sales_user_id')->nullable();$t->integer('manager_user_id')->nullable();$t->string('status')->default('draft');$t->string('quotation_code')->nullable();$t->timestamp('voided_at')->nullable();$t->softDeletes();$t->timestamps();
});
foreach (['quotation_items','payment_allocations','payment_refunds','weekly_report_items','weekly_report_attachments'] as $table) Schema::create($table,function(Blueprint $t){$t->id();$t->integer('quotation_id')->nullable();$t->integer('weekly_report_id')->nullable();$t->integer('sort_order')->default(0);$t->string('content')->nullable();$t->softDeletes();$t->timestamps();});
DB::table('roles')->insert(['id'=>1,'name'=>'Manager']);
$i=0;foreach (['project.view_all','project.update_all','customer.view_all','customer.update_all','quotation.view_all','weeklyreport.view_all'] as $permission) {DB::table('permissions')->insert(['id'=>++$i,'code'=>$permission]); DB::table('role_permissions')->insert(['role_id'=>1,'permission_id'=>$i]);}
DB::table('users')->insert([['id'=>1,'name'=>'Admin','role'=>'ADMIN','role_id'=>1,'department_id'=>10],['id'=>2,'name'=>'Viewer','role'=>'EMPLOYEE','role_id'=>1,'department_id'=>10],['id'=>3,'name'=>'No CRM rights','role'=>'ADMIN','role_id'=>null,'department_id'=>null]]);
DB::table('departments')->insert(['id'=>10,'name'=>'Team']);
DB::table('zt_access_accounts')->insert([['account_id'=>101,'external_id'=>'901','name'=>'Sender','department_id'=>10,'revision'=>0],['account_id'=>102,'external_id'=>'902','name'=>'Other sender','department_id'=>10,'revision'=>0]]);
DB::table('zt_access_grants')->insert(['account_id'=>101,'user_id'=>2,'department_at_grant'=>10,'level'=>'read','can_sync'=>false,'can_link'=>false]);
DB::table('customers')->insert(['id'=>10]); DB::table('projects')->insert(['id'=>100,'customer_id'=>10]);
DB::table('quotations')->insert(['id'=>1,'project_id'=>100,'customer_id'=>10,'quotation_code'=>'Q-test']);
DB::table('weekly_reports')->insert(['id'=>1,'project_id'=>100,'customer_id'=>10,'status'=>'draft']);
DB::table('quotation_items')->insert(['id'=>1,'quotation_id'=>1,'content'=>'original']);
class DocumentCatalog extends ZaloTeamCatalog {
    public string $external='901'; public string $global='GLOBAL1'; public bool $online=true;
    public function command(User $u,array $body):array {
        if($body['action']==='status') return ['accounts'=>[['id'=>101,'externalId'=>$this->external,'status'=>$this->online?'connected':'offline'],['id'=>102,'externalId'=>'902','status'=>'connected']]];
        return ['conversations'=>[['accountId'=>101,'conversationId'=>'g11','globalGroupId'=>$this->global,'name'=>'Customer group'],['accountId'=>102,'conversationId'=>'g22','globalGroupId'=>$this->global,'name'=>'Customer group']]];
    }
}
class DocumentTransport extends ZaloTeamCampaignTransport {
    public $onUpload = null;
    public array $sends=[]; public bool $failUpload=false; public bool $uncertain=false; public bool $checked=false;
    public function uploadFile(string $path, object $asset, int $account,string $peer):string {if($this->failUpload)throw new Exception('upload'); if(!hash_equals($asset->sha256,hash_file('sha256',$path))) throw new Exception('hash');if($this->onUpload)($this->onUpload)();return '11111111-1111-4111-8111-111111111111';}
    public function command(array $body):array {if(!empty($body['checkOnly']))return ['status'=>$this->checked?'sent':'unknown','clientId'=>'verified'];$this->sends[]=$body;return ['status'=>$this->uncertain?'unknown':'sent','clientId'=>'native-'.count($this->sends)];}
}
$catalog=new DocumentCatalog; $transport=new DocumentTransport; $docs=new ZaloCrmDocuments($catalog);$worker=new ZaloCrmDocumentWorker($docs,$transport);$admin=User::find(1);$checks=0;
function check(bool $ok,string $label):void{global $checks;if(!$ok)throw new Exception($label);echo 'PASS '.++$checks.' '.$label."\n";}
function denied(callable $fn,int $status):void{try{$fn();}catch(Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e){check($e->getStatusCode()===$status,'denied '.$status);return;}throw new Exception('Expected denial '.$status);}
function bindRoute(string $kind,int $id,string $mode='own',int $account=101,string $peer='g11'):array{global $docs,$admin;return $docs->saveBinding($admin,$kind,$id,['mode'=>$mode,'accountId'=>$account,'peer'=>$peer,'revision'=>$docs->binding($admin,$kind,$id)['revision']]);}
file_put_contents($temp.'/fixture.png',base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII='));
function enqueue(string $text='hello',string $kind='quotation',?string $requestId=null):array {global $docs,$admin,$temp;$c=$docs->context($admin,$kind,1);return $docs->enqueue($admin,$kind,1,['requestId'=>$requestId??(string)Str::uuid(),'version'=>$c['version'],'destinationVersion'=>$c['destinationVersion'],'text'=>$text],new UploadedFile($temp.'/fixture.png','fixture.png','image/png',null,true));}
check($docs->context($admin,'quotation',1)['destination']===null,'no implicit destination');
bindRoute('customer',10);check($docs->context($admin,'quotation',1)['destination']===null,'project never silently inherits');
bindRoute('project',100,'inherit');check($docs->context($admin,'quotation',1)['destination']['peer']==='g11','explicit inheritance');
denied(fn()=>$docs->context(User::find(3),'quotation',1),403);
denied(fn()=>$docs->verify(User::find(2),101,'g11'),403);
check($docs->context(User::find(2),'quotation',1)['destination']===null,'read-only Zalo grant cannot send');
denied(fn()=>$docs->saveBinding($admin,'project',100,['mode'=>'disabled','revision'=>0]),409);
$catalog->external='777';denied(fn()=>bindRoute('project',100),409);$catalog->external='901';
denied(fn()=>enqueue('report','report'),409);
$c=$docs->context($admin,'quotation',1); DB::table('quotation_items')->where('id',1)->update(['content'=>'changed']);
denied(fn()=>$docs->enqueue($admin,'quotation',1,['requestId'=>(string)Str::uuid(),'version'=>$c['version'],'destinationVersion'=>$c['destinationVersion'],'text'=>'stale'],new UploadedFile($temp.'/fixture.png','f.png','image/png',null,true)),409);
$first=enqueue();$again=enqueue();check($first['id']===$again['id'],'same artifact/version/global group deduplicates');
check(count($transport->sends)===0,'enqueue never sends inline');
bindRoute('project',100,'own',102,'g22');check(enqueue()['id']===$first['id'],'same global group through another account deduplicates');
bindRoute('project',100,'inherit');
$transport->failUpload=true;$worker->tick();$d=$docs->delivery($admin,$first['id']);check($d->state==='failed'&&count($transport->sends)===1,'text success followed by upload failure is partial');
$worker->action($admin,$d->id,'retry');$transport->failUpload=false;$worker->tick();check($docs->delivery($admin,$d->id)->state==='sent'&&count($transport->sends)===2,'retry sends only missing attachment');
check($transport->sends[1]['action']==='send-media'&&$transport->sends[1]['crmSender']['userId']===1,'media attributed to initiating CRM user');
$uncertain=enqueue('uncertain');$transport->uncertain=true;$worker->tick();check($docs->delivery($admin,$uncertain['id'])->state==='unknown','unknown pauses remaining media');
$count=count($transport->sends);denied(fn()=>$worker->action($admin,$uncertain['id'],'retry'),409);$worker->action($admin,$uncertain['id'],'check');check(count($transport->sends)===$count,'checkOnly never sends');
$transport->checked=true;$worker->action($admin,$uncertain['id'],'check');check($docs->delivery($admin,$uncertain['id'])->state==='failed','reconciled text exposes continuation for remaining file');
$transport->uncertain=false;$worker->action($admin,$uncertain['id'],'retry');$worker->tick();check(count($transport->sends)===$count+1,'continuation preserves confirmed text');
$offline=enqueue('offline');$catalog->online=false;$worker->tick();check($docs->delivery($admin,$offline['id'])->state==='failed','offline never dispatches');$catalog->online=true;
$worker->action($admin,$offline['id'],'cancel');check($docs->delivery($admin,$offline['id'])->state==='cancelled','cancel unsent intent');
$changed=enqueue('route changed');bindRoute('project',100,'disabled');$count=count($transport->sends);$worker->tick();check($docs->delivery($admin,$changed['id'])->state==='failed'&&count($transport->sends)===$count,'binding revoked before dispatch blocks');bindRoute('project',100,'inherit');
$revoked=enqueue('inactive');DB::table('users')->where('id',1)->update(['is_active'=>false]);$worker->tick();check($docs->deliveries()->where('id',$revoked['id'])->value('state')==='failed','inactive originating actor blocked');DB::table('users')->where('id',1)->update(['is_active'=>true]);
DB::table('weekly_reports')->where('id',1)->update(['status'=>'approved']);$report=enqueue('','report');$worker->tick();check($docs->delivery($admin,$report['id'])->state==='sent','approved report sends one attachment');
$crash=enqueue('crash');$parts=json_decode($docs->delivery($admin,$crash['id'])->parts,true);$parts[0]['state']='sending';$docs->deliveries()->where('id',$crash['id'])->update(['state'=>'working','parts'=>json_encode($parts),'updated_at'=>now()->subMinutes(7)]);$worker->recover();check($docs->delivery($admin,$crash['id'])->state==='unknown','expired in-flight lease never auto retries');
$uploadRevoked=enqueue('');$transport->onUpload=fn()=>DB::table('users')->where('id',1)->update(['is_active'=>false]);$count=count($transport->sends);$worker->tick();check($docs->deliveries()->where('id',$uploadRevoked['id'])->value('state')==='failed'&&count($transport->sends)===$count,'revocation during upload blocks dispatch');$transport->onUpload=null;DB::table('users')->where('id',1)->update(['is_active'=>true]);
$docs->deliveries()->whereIn('id',[$first['id'],$crash['id']])->update(['updated_at'=>now()->subDays(31)]);check($docs->prune()===1&&!is_file(ZaloCrmDocuments::path($first['id']))&&is_file(ZaloCrmDocuments::path($crash['id'])),'prune expires sent artifact but retains unknown');
check($docs->deliveries()->where('id',$first['id'])->exists(),'prune preserves audit history');
DB::table('zt_access_accounts')->where('account_id',101)->update(['external_id'=>'replacement']);denied(fn()=>$docs->delivery($admin,$crash['id']),403);DB::table('zt_access_accounts')->where('account_id',101)->update(['external_id'=>'901']);
$lock=Illuminate\Support\Facades\Cache::lock('zalo-crm-documents:'.str_repeat('a',64),900);$lock->get();check(!$worker->tick(),'worker mutex prevents concurrent document dispatch');$lock->release();
config(['zalo_team.storage_owner'=>str_repeat('b',64)]);check($docs->deliveries()->count()===0,'storage owners isolated');
echo "PASS $checks document delivery checks; no external messages\n";
