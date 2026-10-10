<?php
putenv('ZALO_TEAM_REMOTE_API_URL=');
putenv('ZALO_TEAM_MAINTENANCE=false');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app=require __DIR__.'/../../apps/backend/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\User;
use App\Services\ZaloTeamPcSession;
use App\Services\ZaloTeamCatalog;
$root=sys_get_temp_dir().'/zt-pc-session-'.bin2hex(random_bytes(6));mkdir($root);
config(['zalo_team.pc_session_path'=>$root]);
$app->instance('env','local');
$catalog=new class extends ZaloTeamCatalog { public array $accounts=[['id'=>1,'externalId'=>'123','name'=>'Test','status'=>'connected']];public function command(User $u,array $body):array{return ['accounts'=>$this->accounts];}};
$app->instance(ZaloTeamCatalog::class,$catalog);
$recovery=new class extends App\Services\ZaloTeamPcRecovery {
 public array $ids=[];
 public function seed(string $owner,$assets=null,bool $retry=false,?int $account=null):int{return 0;}
 public function conversations(array $session):array{return array_values(array_intersect($this->ids,array_column($session['conversations'],'conversationId')));}
};
$app->instance(App\Services\ZaloTeamPcRecovery::class,$recovery);
$u=new User;$u->id=1;$other=new User;$other->id=2;
$pc=new class extends ZaloTeamPcSession {
 public array $nativeCalls=[];
 protected function native(string $action):void{$this->nativeCalls[]=$action;}
 public function completed():void{$this->finishBatch();}
 public function livePulse():void{$this->pulse();}
 public function claim():?array{return $this->claimNext();}
 public function done(string $cid,array $r):void{$this->completeCurrent($cid,$r);}
 public function schedule():void{$this->scheduleRecovery();}
};$n=0;
function check($v,$why){global $n;if(!$v)throw new Exception($why);$n++;}
function rejects($f,$code){try{$f();}catch(Symfony\Component\HttpKernel\Exception\HttpException $e){check($e->getStatusCode()===$code,'status');return;}throw new Exception('Expected refusal');}
try {
 check($pc->status($u)['state']==='disconnected','initial disconnected');
 rejects(fn()=>$pc->command($u,['kind'=>'pc-connect','accountId'=>1,'confirm'=>true]),409);
 touch($root.'/heartbeat');
 rejects(fn()=>$pc->command($u,['kind'=>'pc-connect','accountId'=>1,'confirm'=>false]),422);
 rejects(fn()=>$pc->command($u,['kind'=>'pc-connect','accountId'=>999,'confirm'=>true]),403);
 $r=$pc->command($u,['kind'=>'pc-connect','accountId'=>1,'confirm'=>true]);check($r['state']==='queued-connect','connect queued, no process launched by request');
 check(!isset($r['externalId'],$r['owner'],$r['userId']),'private state not exposed');
 rejects(fn()=>$pc->command($u,['kind'=>'pc-connect','accountId'=>1,'confirm'=>true]),409);
 check($pc->status($other)['state']==='busy'&&!isset($pc->status($other)['accountName']),'other owner no catalog leak');
 rejects(fn()=>$pc->command($other,['kind'=>'pc-disconnect']),409);
 $s=json_decode(file_get_contents($root.'/session.json'),true);$s['state']='ready';$s['expires']=time()+900;$s['conversations']=[['conversationId'=>'g456','name'=>'Group']];file_put_contents($root.'/session.json',json_encode($s));
 rejects(fn()=>$pc->command($u,['kind'=>'pc-import','conversations'=>['g999']]),422);
 $catalog->accounts=[];rejects(fn()=>$pc->command($u,['kind'=>'pc-import','conversations'=>['g456']]),403);
 $catalog->accounts=[['id'=>1,'externalId'=>'123','name'=>'Test','status'=>'connected']];
 check($pc->command($u,['kind'=>'pc-import','conversations'=>['g456']])['state']==='queued-import','valid scope queued');
 rejects(fn()=>$pc->command($u,['kind'=>'pc-import','conversations'=>['g456']]),409);
 $pc->command($u,['kind'=>'pc-disconnect']);check(json_decode(file_get_contents($root.'/session.json'),true)['cancel']===true,'cancel persisted');
 $s['state']='complete';file_put_contents($root.'/session.json',json_encode($s));check($pc->status($other)['state']==='disconnected','completed owner does not block next user');
 $s['state']='ready';$s['conversations']=array_map(fn($i)=>['conversationId'=>'g'.$i,'name'=>'Group '.$i],range(1,65));
 file_put_contents($root.'/session.json',json_encode($s));
 rejects(fn()=>$pc->command($u,['kind'=>'pc-import']),422);
 $r=$pc->command($u,['kind'=>'pc-import','all'=>true,'conversations'=>['g999']]);
 check(count($r['selected'])===65 && $r['selected'][64]==='g65','import all uses verified full catalog, not client IDs or 50-row cap');
 rejects(fn()=>$pc->command($u,['kind'=>'pc-import','all'=>true]),409);
 $pc->command($u,['kind'=>'pc-stop']);$pc->tick();$r=$pc->status($u);
 check($r['state']==='ready'&&count($r['remaining'])===65,'stop queued batch retains full queue and connection');
 check($pc->nativeCalls===[],'stopping batch does not restart native PC');
 $r=$pc->command($u,['kind'=>'pc-import','conversations'=>['g1','g2']]);
 $pc->done('g1',['source'=>'first']);$pc->done('g2',['source'=>'second']);
 file_put_contents($root.'/lease.json',json_encode(['sessionId'=>'verified-session','pid'=>123,'expires'=>time()]));
 $pc->completed();$r=$pc->status($u);
 check($r['state']==='ready'&&count($r['conversations'])===65&&$r['remaining']===[],'completed batch preserves catalog and clears remaining queue');
 check(count($r['results'])===2&&$pc->nativeCalls===[],'completed results retained without close/open');
 check(json_decode(file_get_contents($root.'/lease.json'),true)['expires']>=time()+895,'completion renews bounded idle lease');
 check($pc->status($other)['state']==='busy','connected session remains owner scoped after batch');
 check($pc->command($u,['kind'=>'pc-import','conversations'=>['g3']])['state']==='queued-import','next batch starts without reconnect');
 $pc->command($u,['kind'=>'pc-stop']);$pc->tick();
 $pc->command($u,['kind'=>'pc-disconnect']);$pc->tick();
 check($pc->nativeCalls===['Close']&&$pc->status($u)['state']==='disconnected','explicit disconnect closes exactly once');
 $pc->tick();check($pc->nativeCalls===['Close'],'idle ticks never repeat close');
 $s['expires']=time()-1;$s['state']='ready';file_put_contents($root.'/session.json',json_encode($s));
 rejects(fn()=>$pc->command($u,['kind'=>'pc-import','all'=>true]),409);
 $pc->tick();check($pc->status($u)['state']==='disconnected'&&count($pc->nativeCalls)===2,'expired idle session closes once');
 $s['state']='ready';$s['expires']=time()+900;$s['conversations']=array_map(fn($i)=>['conversationId'=>'g'.$i,'name'=>'Group '.$i],range(1,4));file_put_contents($root.'/session.json',json_encode($s));
 $pc->command($u,['kind'=>'pc-import','conversations'=>['g1','g2','g3']]);
 check($pc->claim()['current']==='g1','claims first durable item');
 rejects(fn()=>$pc->command($u,['kind'=>'pc-prioritize','conversationId'=>'g999']),422);
 rejects(fn()=>$pc->command($u,['kind'=>'pc-prioritize','conversationId'=>'g1']),409);
 $r=$pc->command($u,['kind'=>'pc-prioritize','conversationId'=>'g3']);
 check($r['current']==='g1'&&$r['remaining']===['g3','g1','g2'],'priority never aborts current export');
 $pc->done('g1',['source'=>'one','conversationId'=>'g1']);
 check($pc->claim()['current']==='g3','next claim honors priority instead of stale for loop');
 $pc->command($u,['kind'=>'pc-prioritize','conversationId'=>'g4']);
 $pc->done('g3',['source'=>'three','conversationId'=>'g3']);
 check($pc->status($u)['remaining']===['g4','g2'],'completion removes by ID and preserves newly added priority');
 $state=json_decode(file_get_contents($root.'/session.json'),true);$state['state']='exporting';file_put_contents($root.'/session.json',json_encode($state));
 $pc->livePulse();check($pc->status($u)['state']==='exporting','heartbeat during active export must not classify worker as interrupted');
 $pc->tick();$r=$pc->status($u);
 check(str_contains($r['error'],'gián đoạn'),'stale execution detected before database or native read');
 check($r['state']==='error'&&$r['remaining']===['g4','g2']&&count($r['results'])===2,'worker crash preserves remaining and completed results');
 $r=$pc->command($u,['kind'=>'pc-connect','accountId'=>1,'confirm'=>true]);
 check($r['remaining']===['g4','g2']&&count($r['results'])===2,'same-account reconnect retains queue');
 $state=json_decode(file_get_contents($root.'/session.json'),true);$state['state']='ready';$state['expires']=time()+900;$state['conversations']=$s['conversations'];file_put_contents($root.'/session.json',json_encode($state));
 $r=$pc->command($u,['kind'=>'pc-import','resume'=>true]);
 check($r['remaining']===['g4','g2']&&count($r['results'])===2,'resume preserves completed results');
 $pc->done('g4',['source'=>'four']);$pc->done('g2',['source'=>'two']);$pc->completed();
 check($pc->status($u)['remaining']===[],'resume drains exact queue without duplicate results');
 rejects(fn()=>$pc->command($u,['kind'=>'pc-prioritize','accountId'=>99,'conversationId'=>'g1']),409);
 $r=$pc->command($u,['kind'=>'pc-prioritize','accountId'=>1,'conversationId'=>'g1','start'=>true]);
 check($r['state']==='queued-import'&&$r['remaining']===['g1'],'recovery action starts idle queue atomically for the matched account');
 $state=json_decode(file_get_contents($root.'/session.json'),true);$state['state']='error';file_put_contents($root.'/session.json',json_encode($state));
 $state['state']='ready';$state['remaining']=[];$state['recoveryPaused']=false;file_put_contents($root.'/session.json',json_encode($state));
 $recovery->ids=['g2','g3','g999'];$pc->schedule();$pc->schedule();$r=$pc->status($u);
 check($r['state']==='queued-import'&&$r['remaining']===['g2','g3'],'automatic recovery uses verified catalog, deduplicates queue and starts without a per-file click');
 $pc->command($u,['kind'=>'pc-stop']);$pc->tick();$pc->schedule();
 check($pc->status($u)['state']==='ready'&&$pc->status($u)['recoveryPaused'],'user stop wins over automatic recovery');
 $pc->command($u,['kind'=>'pc-import','resume'=>true]);
 check(!$pc->status($u)['recoveryPaused'],'explicit resume enables recovery again');
 $state=json_decode(file_get_contents($root.'/session.json'),true);$state['state']='error';file_put_contents($root.'/session.json',json_encode($state));
 $catalog->accounts[]=['id'=>2,'externalId'=>'999','name'=>'Other account','status'=>'connected'];
 $r=$pc->command($u,['kind'=>'pc-connect','accountId'=>2,'confirm'=>true]);
 check(empty($r['remaining'])&&$r['results']===[],'different account never inherits private queue');
 echo "PASS $n PC session checks\n";
}finally{foreach(glob($root.'/*') as $file)unlink($file);rmdir($root);}
