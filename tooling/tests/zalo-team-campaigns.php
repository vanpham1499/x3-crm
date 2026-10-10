<?php
// Disposable in-memory database and fake connector/identity. Never sends real messages.
putenv('ZALO_TEAM_RUNTIME=zalo');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app=require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\{DB,Schema,Http};
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Str;
use App\Models\ZaloTeamIdentityUser;
use App\Services\{ZaloTeamCampaigns,ZaloTeamCampaignWorker,ZaloTeamCampaignTransport,ZaloTeamCatalog};
config(['database.default'=>'campaign_test','database.connections.campaign_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>''],
    'zalo_team.workspace'=>'test','zalo_team.public_origin'=>'https://test.invalid','zalo_team.storage_owner'=>str_repeat('a',64)]);
Http::preventStrayRequests();
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_08_000220_create_zalo_team_campaigns.php')->up();
Schema::create('zt_tags',function(Blueprint $t){$t->string('workspace');$t->string('id');$t->string('name');$t->integer('position');$t->boolean('archived');});
Schema::create('zt_tag_assignments',function(Blueprint $t){$t->string('workspace');$t->string('source');$t->string('tag_id');$t->boolean('active');});
function check($ok,$label){if(!$ok)throw new Exception($label);echo "PASS $label\n";}
function denied(callable $fn,int $code){try{$fn();throw new Exception('Expected denial');}catch(Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e){check($e->getStatusCode()===$code,'denied '.$code);}}
function actor($permission=true,$write=true,$id=1){$u=new ZaloTeamIdentityUser;$u->forceFill(['id'=>$id,'is_active'=>true,'zalo_permissions'=>$permission?['zalo_team.campaigns.send']:[],
    'zalo_access'=>['admin'=>false,'userName'=>'Nhân viên thử','accounts'=>[7=>['read'=>true,'write'=>$write,'manage'=>false]]]]);return $u;}
class CatalogFake extends ZaloTeamCatalog {
    public function command(\App\Models\User $u,array $b):array {return $b['action']==='status'?['accounts'=>[['id'=>7,'externalId'=>'777','name'=>'Zalo thử','status'=>'connected']]]:
        ['items'=>array_map(fn($i)=>['id'=>(string)$i,'name'=>'Khách '.$i],range(100,150))];}
}
class TransportFake extends ZaloTeamCampaignTransport {
    public $user;public array $sent=[];public bool $lose=false;public $beforeSend=null;public $onOpen=null;public int $uploads=0;public array $checks=[];
    public function actor(int $id):\App\Models\User {return $this->user;}
    public function upload($asset,int $account,string $peer):string {$this->uploads++;return (string)Str::uuid();}
    public function command(array $b):array {
        if($b['action']==='status')return ['campaignProtocol'=>1,'accounts'=>[['id'=>7,'externalId'=>'777','status'=>'connected']]];
        if($b['action']==='directory'){if($this->onOpen)($this->onOpen)();return ['status'=>'opened'];}
        // Match the real connector contract, including check-only reconciliation.
        if($b['action']==='send-media' && array_key_exists('text',$b)) throw new RuntimeException('INVALID_REQUEST');
        if($b['checkOnly']??false){$this->checks[]=$b;return ['status'=>'sent','messageId'=>'123'];}
        $this->sent[]=$b;if($this->beforeSend)($this->beforeSend)();if($this->lose)throw new RuntimeException('LOST_RESPONSE');return ['status'=>'sent','messageId'=>(string)count($this->sent)];
    }
}
$app->instance(ZaloTeamCatalog::class,new CatalogFake);
$s=new ZaloTeamCampaigns;$t=new TransportFake;$u=actor();$t->user=$u;$w=new ZaloTeamCampaignWorker($t,$s);
DB::table('zt_campaign_workers')->insert(['key'=>$s->workerKey(),'seen_at'=>now()]);
function draft($peer,$extra=[]){global $s,$u;return $s->create($u,array_replace(['requestId'=>(string)Str::uuid(),'accountId'=>7,'type'=>'person','name'=>'Kiểm thử','text'=>'Chào {ten_khach}',
    'peers'=>[(string)$peer],'includeTags'=>[],'excludeTags'=>[],'interval'=>30,'startHour'=>0,'endHour'=>24],$extra));}
function unlock(){DB::table('zt_campaign_accounts')->update(['next_at'=>null]);}
function start($c){global $s,$u;$s->transition($u,$c['id'],'start',null);unlock();}
denied(fn()=>$s->authorize(actor(false),7),403);denied(fn()=>$s->authorize(actor(true,false),7),403);
$tag=(string)Str::uuid();DB::table('zt_tags')->insert(['workspace'=>'test','id'=>$tag,'name'=>'VIP','position'=>0,'archived'=>false]);
DB::table('zt_tag_assignments')->insert(['workspace'=>'test','source'=>'777:100','tag_id'=>$tag,'active'=>true]);
check(count($s->audience($u,['accountId'=>7,'type'=>'person','includeTags'=>[$tag]])['rows'])===1,'server-side tag filtering');
check(count($s->audience($u,['accountId'=>7,'type'=>'person','excludeTags'=>[$tag]])['rows'])===50,'tag exclusions');
$v=['requestId'=>(string)Str::uuid(),'accountId'=>7,'type'=>'person','name'=>'Idempotent','text'=>'Hello','peers'=>['100'],'interval'=>30,'startHour'=>0,'endHour'=>24];
$a=$s->create($u,$v);$s->create($u,$v);check(DB::table('zt_campaign_recipients')->where('campaign_id',$a['id'])->count()===1,'repeat create keeps one recipient');
denied(fn()=>$s->create($u,array_replace($v,['text'=>'changed'])),409);
denied(fn()=>$s->create($u,array_replace($v,['requestId'=>(string)Str::uuid(),'peers'=>['100','100']])),409);
denied(fn()=>$s->get(actor(true,true,2),$a['id']),403);
$first=draft('101');check($first['rows'][0]['parts'][0]['text']==='Chào Khách 101','personalized snapshot');start($first);
$claim=$w->claim();check($claim!==null,'claim persisted recipient');check($w->claim()===null,'second worker cannot claim leased account');
DB::table('zt_campaign_accounts')->update(['lease_until'=>now()->subMinutes(6)]);DB::table('zt_campaign_deliveries')->where('id',$claim[1]->id)->update(['updated_at'=>now()->subMinutes(6)]);
$w->tick();check(count($t->sent)===1,'recover preparation and send once');unlock();$w->tick();check(count($t->sent)===1,'restart does not resend sent item');
$unknown=draft('102');start($unknown);$t->lose=true;$w->tick();$t->lose=false;
$d=DB::table('zt_campaign_deliveries')->where('campaign_id',$unknown['id'])->first();check($d->state==='unknown','lost acknowledgement is unknown');
unlock();$w->tick();check(count($t->sent)===2,'unknown is not automatically retried');
$w->retry($u,$unknown['id'],$d->id);check(count($t->sent)===2 && count($t->checks)===1,'reconcile uses check-only, never send');
$revoke=draft('103');start($revoke);$t->user=actor(false);$w->tick();$t->user=$u;check(count($t->sent)===2,'revoked permission blocks dispatch');
$paused=draft('104');start($paused);$t->onOpen=fn()=>$s->transition($u,$paused['id'],'pause',null);$w->tick();$t->onOpen=null;check(count($t->sent)===2,'pause during preparation prevents sending');
$cancel=draft('105');start($cancel);$t->onOpen=fn()=>$s->transition($u,$cancel['id'],'cancel',null);$w->tick();$t->onOpen=null;
check(DB::table('zt_campaign_deliveries')->where('campaign_id',$cancel['id'])->value('state')==='cancelled','cancel preparation preserves cancellation');
$suppressed=draft('106');$s->suppress($u,$suppressed['id'],$suppressed['rows'][0]['id']);start($suppressed);$w->tick();
check(DB::table('zt_campaign_deliveries')->where('campaign_id',$suppressed['id'])->value('state')==='skipped','opt-out rechecked at dispatch');unlock();$w->tick();
$s->suppress($u,$suppressed['id'],$suppressed['rows'][0]['id'],false);
check(!$s->detail($u,$suppressed['id'],0)['rows'][0]['suppressed'] && DB::table('zt_campaign_deliveries')->where('campaign_id',$suppressed['id'])->value('state')==='skipped','allowing future campaigns does not resend skipped messages');
$asset=(string)Str::uuid();DB::table('zt_campaign_assets')->insert(['id'=>$asset,'workspace'=>'test','actor_id'=>1,'name'=>'test.png','mime'=>'image/png','kind'=>'image','bytes'=>1,'sha256'=>str_repeat('a',64),'created_at'=>now()]);
$multi=draft('107',['assetIds'=>[$asset]]);start($multi);$w->tick();unlock();$t->lose=true;$w->tick();$t->lose=false;
$parts=DB::table('zt_campaign_deliveries')->where('campaign_id',$multi['id'])->orderBy('position')->get();check($parts[0]->state==='sent'&&$parts[1]->state==='unknown','multipart preserves confirmed text when image response lost');
$before=count($t->sent);$w->retry($u,$multi['id'],$parts[1]->id);check(count($t->sent)===$before,'media reconciliation does not resend text or restage upload');
check(!array_key_exists('text',end($t->sent)) && !array_key_exists('text',end($t->checks)), 'media dispatch and reconciliation omit the forbidden text field');
$future=draft('108');$s->transition($u,$future['id'],'start',now()->addDay()->toISOString());unlock();$w->tick();check(count($t->sent)===$before,'scheduled future campaign does not send early');
DB::flushQueryLog();DB::enableQueryLog();$s->listing($u);
check(count(DB::getQueryLog())===3,'campaign list uses three queries regardless of row count');DB::disableQueryLog();

// A separate transaction exercises >100 rows, stable ordering and scoped counts.
DB::beginTransaction();
$template=(array)DB::table('zt_campaigns')->where('id',$a['id'])->first();
for($i=0;$i<121;$i++) {
    $copy=array_replace($template,['id'=>(string)Str::uuid(),'name'=>'Paging literal% '.$i,'state'=>'draft','created_at'=>'2026-01-01 00:00:00']);
    DB::table('zt_campaigns')->insert($copy);
}
$collected=[];
for($p=0;$p<5;$p++) {
    $batch=$s->listing($u,$p,25,'Paging literal%','draft');
    check($batch['pagination']['total']===121 && count($batch['items'])===($p===4?21:25),'server pagination reaches rows beyond 100');
    $collected=array_merge($collected,array_column($batch['items'],'id'));
}
check(count(array_unique($collected))===121,'stable tie ordering has no duplicate campaign');
check($s->listing($u,0,25,'Paging literal_','draft')['pagination']['total']===0,'search treats SQL wildcard literally');
check($s->listing(actor(true,true,2),0,25,'Paging','draft')['pagination']['total']===0,'page total respects creator ACL');
$manager=actor(true,true,2);$manager->setAttribute('zalo_access',['admin'=>false,'accounts'=>[7=>['read'=>true,'manage'=>true]]]);
check($s->listing($manager,0,25,'Paging','draft')['pagination']['total']===121,'manager can list team campaigns');
config(['zalo_team.public_origin'=>'https://another.invalid']);
check($s->listing($u,0,25,'Paging','draft')['pagination']['total']===0,'pagination remains identity-origin scoped');
config(['zalo_team.public_origin'=>'https://test.invalid']);
DB::flushQueryLog();DB::enableQueryLog();$s->listing($u,0,25);
check(count(DB::getQueryLog())===4,'paged list adds only one count query');DB::disableQueryLog();
DB::rollBack();
denied(fn()=>draft('109',['text'=>str_repeat('😀',1001)]),422);
config(['zalo_team.remote_api_url'=>null,'zalo_team.maintenance'=>false]);
$controller=new App\Http\Controllers\ZaloTeamCampaignController;
$payload=['kind'=>'create','requestId'=>(string)Str::uuid(),'accountId'=>7,'type'=>'person','name'=>'Composer 10s','text'=>'Chào {ten_khach} 😀 — {ten_nhan_vien}', 'peers'=>['149'],'interval'=>10,'startHour'=>0,'endHour'=>24];
$request=Illuminate\Http\Request::create('/campaigns','POST',$payload);$request->setUserResolver(fn()=>$u);
$created=$controller->command($request,$s)->getData(true);
check($created['interval']===10 && $created['state']==='draft','controller accepts 10-second draft without sending');
check($created['rows'][0]['parts'][0]['text']==='Chào Khách 149 😀 — Nhân viên thử','composer fields and emoji survive personalized preview');
$request=Illuminate\Http\Request::create('/campaigns','POST',array_replace($payload,['interval'=>9]));$request->setUserResolver(fn()=>$u);
try {$controller->command($request,$s);throw new Exception('Accepted interval below 10');}
catch (Illuminate\Validation\ValidationException $e) {check(isset($e->errors()['interval']),'controller rejects interval below 10 seconds');}
// Lifecycle operations are exercised against disposable data, never the live campaigns.
$repeat=draft('101'); $sentBefore=count($t->sent); start($repeat); $w->tick();
check(count($t->sent)===$sentBefore+1,'a second confirmed campaign is not silently skipped within 24 hours');
unlock(); $w->tick();
$edit=draft('120'); $input=$s->editData($u,$edit['id']);
$update=['kind'=>'update','id'=>$edit['id'],'requestId'=>(string)Str::uuid(),'revision'=>$input['revision'],'accountId'=>7,'type'=>'person','match'=>'all','name'=>'Edited',
    'text'=>'Mới {ten_khach}','peers'=>['121','122'],'assetIds'=>[$asset],'interval'=>10,'startHour'=>0,'endHour'=>24];
$edited=$s->create($u,$update,$edit['id']);
check($edited['name']==='Edited' && $edited['recipients']===2 && $edited['counts']['queued']===4 && $edited['state']==='draft','draft edit atomically replaces recipients and personalized parts');
check($s->editData($u,$edit['id'])['filters']['match']==='all','editing preserves tag match mode');
denied(fn()=>$s->create($u,$update,$edit['id']),409);
denied(fn()=>$s->editData(actor(true,true,2),$edit['id']),403);
start($edited); $update['revision']=$s->editData($u,$edit['id'])['revision'];
denied(fn()=>$s->create($u,$update,$edit['id']),409);
denied(fn()=>$s->remove($u,$edit['id']),409);
$s->transition($u,$edit['id'],'cancel',null);
$ready=$s->requeue($u,$edit['id']);
check($ready['state']==='paused' && $ready['counts']['queued']===4,'requeue restores cancelled unsent parts but requires a separate resume');
$delivery=DB::table('zt_campaign_deliveries')->where('campaign_id',$edit['id'])->orderBy('position')->first();
DB::table('zt_campaign_deliveries')->where('id',$delivery->id)->update(['state'=>'sent','dispatched_at'=>now()]);
DB::table('zt_campaign_deliveries')->where('campaign_id',$edit['id'])->where('id','!=',$delivery->id)->update(['state'=>'skipped']);
$ready=$s->requeue($u,$edit['id']);
check($ready['counts']['sent']===1 && $ready['counts']['queued']===3 && DB::table('zt_campaign_deliveries')->where('id',$delivery->id)->value('state')==='sent','rerun retains sent receipts and does not duplicate confirmed sends');
$pending=DB::table('zt_campaign_deliveries')->where('campaign_id',$edit['id'])->where('state','queued')->first();
DB::table('zt_campaign_deliveries')->where('id',$pending->id)->update(['state'=>'unknown','dispatched_at'=>now()]);
denied(fn()=>$s->requeue($u,$edit['id']),409);
denied(fn()=>$s->remove($u,$edit['id']),409);
denied(fn()=>$s->transition($u,$edit['id'],'resume',null),409);
DB::table('zt_campaign_deliveries')->where('id',$pending->id)->update(['state'=>'sent']);
$root=sys_get_temp_dir().DIRECTORY_SEPARATOR.'campaign-preview-'.Str::uuid(); mkdir($root,0700);
config(['zalo_team.campaign_path'=>$root]); file_put_contents($root.DIRECTORY_SEPARATOR.$asset,'test-image');
try {
    $image=$s->previewAsset($u,$edit['id'],$asset);
    check($image->headers->get('content-type')==='image/png' && $image->headers->get('x-content-type-options')==='nosniff','image preview uses authenticated asset metadata');
    denied(fn()=>$s->previewAsset(actor(true,true,2),$edit['id'],$asset),403);
    denied(fn()=>$s->previewAsset($u,$first['id'],$asset),404);
} finally { unlink($root.DIRECTORY_SEPARATOR.$asset); rmdir($root); }
$s->remove($u,$edit['id']);
denied(fn()=>$s->get($u,$edit['id']),404);
check(!collect($s->listing($u))->contains('id',$edit['id']) && DB::table('zt_campaign_deliveries')->where('id',$delivery->id)->value('state')==='sent','deletion hides campaign and retains delivery receipts');
check(DB::table('zt_campaign_audits')->where('campaign_id',$edit['id'])->whereIn('action',['update','requeue','delete'])->count()===4,'lifecycle changes have an audit trail');
config(['zalo_team.public_origin'=>'http://localhost:3000']);check($s->listing($u)===[] && !$s->workerReady(),'local identity cannot run or inspect production campaign');
config(['database.default'=>'crm_test','database.connections.crm_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>''],'zalo_team.runtime'=>'crm']);
Schema::create('permissions',function(Blueprint $t){$t->string('code');$t->string('module');$t->string('name');$t->string('description');$t->timestamps();});
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_08_000220_create_zalo_team_campaigns.php')->up();
check(DB::table('permissions')->where('code','zalo_team.campaigns.send')->exists() && !Schema::hasTable('zt_campaigns'),'CRM migration stores permission without campaign data');
echo "Campaign regression complete; no external requests sent.\n";
