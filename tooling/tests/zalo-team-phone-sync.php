<?php
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app=require __DIR__.'/../../apps/backend/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\User;
use App\Services\{ZaloTeamArchive,ZaloTeamCatalog,ZaloTeamPhoneSync};
use Illuminate\Support\Facades\{DB,Schema};
use Illuminate\Database\Schema\Blueprint;
set_exception_handler(function(Throwable $e){fwrite(STDERR,'FAIL: '.$e->getMessage()."\n");exit(1);});
$root=sys_get_temp_dir().'/zt-phone-test-'.bin2hex(random_bytes(6));
config(['database.default'=>'phone_test','database.connections.phone_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>''],'zalo_team.archive_path'=>$root]);
DB::purge('phone_test');if(DB::connection()->getDatabaseName()!==':memory:')throw new Exception('Unsafe test DB');
Schema::create('users',fn(Blueprint $t)=>$t->id());DB::table('users')->insert([['id'=>1],['id'=>2]]);
foreach(['000200_create_zalo_team_archive','000203_add_zalo_archive_progress','000206_create_zalo_phone_sync_jobs'] as $name){$m=require __DIR__.'/../../apps/backend/database/migrations/2026_10_03_'.$name.'.php';$m->up();}
$u=new User;$u->id=1;$other=new User;$other->id=2;$archive=new ZaloTeamArchive;
$catalog=new class extends ZaloTeamCatalog {
 public array $accounts=[['id'=>1,'externalId'=>'123','status'=>'connected']];public array $receipts=[];public int $starts=0;public bool $uncertain=false;public bool $available=true;
 public function command(User $u,array $body):array {
  if($body['action']==='status')return ['accounts'=>$this->accounts];
  $s=$body['sync'];$id=$s['id']??null;
  if($s['operation']==='start'){$this->starts++;$this->receipts[$id]=['id'=>$id,'state'=>'running'];if($this->uncertain)throw new RuntimeException('response lost');}
  if($s['operation']==='cancel'&&isset($this->receipts[$id]))$this->receipts[$id]['state']='cancelled';
  return ['available'=>$this->available,'ranges'=>['other'=>['fromTs'=>100,'toTs'=>999]],'job'=>$this->receipts[$id]??null];
 }
};
$service=new ZaloTeamPhoneSync($archive,$catalog);$owner=ZaloTeamArchive::owner($u);$archive->settings($u);
DB::table('zt_archive_settings')->where('owner',$owner)->update(['enabled'=>true,'accounts'=>'[1]','heartbeat'=>now()]);
DB::table('zt_archive_sources')->insert(['id'=>str_repeat('a',64),'owner'=>$owner,'account_id'=>1,'external_id'=>'123','conversation_id'=>'456','canonical'=>'source:fixture','name'=>'Fixture','account_name'=>'Fixture','history_done'=>true,'cursor'=>'{"id":"kept"}']);
$n=0;function check($v,$message){global $n;if(!$v)throw new Exception($message);$n++;}
function rejected($fn,$status){try{$fn();}catch(Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e){check($e->getStatusCode()===$status,'http status');return;}throw new Exception('Expected refusal');}
function startArgs($id){return ['kind'=>'phone-start','accountId'=>1,'requestId'=>$id];}
$id='11111111-1111-4111-8111-111111111111';$id2='22222222-2222-4222-8222-222222222222';
try {
 check($service->command($u,['kind'=>'phone-status','accountId'=>1])['job']===null,'initial status');
 $r=$service->command($u,startArgs($id));check($r['job']['state']==='queued'&&$catalog->starts===0,'request queues before remote mutation');
 $service->command($u,startArgs($id));check(DB::table('zt_phone_sync_jobs')->count()===1,'request replay idempotent');
 rejected(fn()=>$service->command($u,startArgs($id2)),409);
 rejected(fn()=>$service->command($other,startArgs($id)),409);
 $catalog->uncertain=true;$service->tick($u);check(DB::table('zt_phone_sync_jobs')->value('state')==='starting','uncertain start retained');
 $catalog->uncertain=false;$service->tick($u);check($catalog->starts===1&&DB::table('zt_phone_sync_jobs')->value('state')==='running','recover receipt without duplicate start');
 $catalog->receipts[$id]['state']='received';$service->tick($u);
 $row=DB::table('zt_phone_sync_jobs')->first();check($row->state==='received'&&$row->archive_requested,'received is distinct from archive completion; rescan queued');
 check(!DB::table('zt_archive_sources')->value('history_done')&&DB::table('zt_archive_sources')->value('cursor')===null,'rescan after phone fills non-tail gaps');
 DB::table('zt_archive_sources')->update(['history_done'=>true]);$service->tick($u);check((bool)DB::table('zt_archive_sources')->value('history_done'),'completed job does not reset checkpoints twice');
 $service->command($u,startArgs($id));check($catalog->starts===1,'terminal request replay never restarts');
 $service->command($u,startArgs($id2));$service->command($u,['kind'=>'phone-cancel','accountId'=>1,'requestId'=>$id2]);$service->tick($u);
 check(DB::table('zt_phone_sync_jobs')->where('id',$id2)->value('state')==='cancelled'&&$catalog->starts===1,'queued cancellation sends no request');
 rejected(fn()=>$service->command($other,['kind'=>'phone-cancel','accountId'=>1,'requestId'=>$id]),404);
 $id3='33333333-3333-4333-8333-333333333333';$service->command($u,startArgs($id3));$service->tick($u);$catalog->receipts=[];$service->tick($u);
 check(DB::table('zt_phone_sync_jobs')->where('id',$id3)->value('state')==='interrupted','connector restart is interruption, not false success');
 $id4='44444444-4444-4444-8444-444444444444';$service->command($u,startArgs($id4));$catalog->accounts[0]['externalId']='999';$service->tick($u);
 check(DB::table('zt_phone_sync_jobs')->where('id',$id4)->value('state')==='interrupted'&&$catalog->starts===2,'account replacement blocks native call');
 $catalog->accounts[0]['externalId']='123';$id5='55555555-5555-4555-8555-555555555555';$service->command($u,startArgs($id5));$service->tick($u);
 DB::table('zt_archive_sources')->update(['history_done'=>true]);$catalog->receipts[$id5]['state']='no_changes';$service->tick($u);
 check(DB::table('zt_phone_sync_jobs')->where('id',$id5)->value('state')==='no_changes'&&(bool)DB::table('zt_archive_sources')->value('history_done'),'no changes does not restart all historical scans');
 $catalog->available=false;rejected(fn()=>$service->command($u,startArgs('66666666-6666-4666-8666-666666666666')),409);
 check(DB::table('zt_archive_sources')->count()===1,'control flow never deletes stored data');
 $catalog->available=true;$id6='66666666-6666-4666-8666-666666666666';$service->command($u,startArgs($id6));$service->tick($u);
 $catalog->receipts[$id6]=['id'=>$id,'state'=>'received'];$service->tick($u);
 check(DB::table('zt_phone_sync_jobs')->where('id',$id6)->value('state')==='interrupted','wrong native receipt never reports success for this job');
 echo "PASS $n phone sync persistence/scope checks\n";
} finally {foreach(glob($root.'/locks/*')?:[] as $p)unlink($p);if(is_dir($root.'/locks'))rmdir($root.'/locks');if(is_dir($root))rmdir($root);}
