<?php
// No network, database or real Zalo state. Only an isolated temporary directory.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Services\{ZaloTeamFileImport,ZaloTeamCatalog,ZaloTeamArchive,ZaloTeamArchiveBackup};
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{File,Http};
$root=sys_get_temp_dir().'/zt-file-control-'.bin2hex(random_bytes(8));mkdir($root,0700,true);
$app->useStoragePath($root);$app->instance('env','local');Http::preventStrayRequests();
$app->instance(ZaloTeamCatalog::class,new class extends ZaloTeamCatalog {
    public function command(User $u,array $v):array {return ['accounts'=>[['id'=>1,'externalId'=>'123','name'=>'Test']]];}
});
$u=new User;$u->id=912345;$service=new class extends ZaloTeamFileImport {
    protected function launchPicker(string $root,string $id):void {} // No native UI in fixture tests.
};$owner=ZaloTeamArchive::owner($u);$checks=0;
function ok($v,$label){global $checks;if(!$v)throw new Exception($label);$checks++;}
function refuses($fn,int $status,$label){try{$fn();}catch(Symfony\Component\HttpKernel\Exception\HttpException $e){ok($e->getStatusCode()===$status,$label);return;}throw new Exception('Accepted '.$label);}
try {
    $source=$root.'/fixture.zl.zip';file_put_contents($source,'not read before unlock');
    refuses(fn()=>$service->command($u,['kind'=>'file-pick','accountId'=>2]),403,'picker rejects foreign account');
    $picked=$service->command($u,['kind'=>'file-pick','accountId'=>1]);
    ok($picked['picker']['state']==='pending','picker starts without importing');
    $job=$root.'/app/private/zalo-file-import/'.$owner;
    $selectionId=$picked['picker']['id'];
    refuses(fn()=>$service->command($u,['kind'=>'file-pick','accountId'=>1]),409,'duplicate native dialogs blocked');
    file_put_contents($job.'/picker-result.json',json_encode(['id'=>'wrong','state'=>'selected','path'=>$source]));
    ok($service->status($u)['picker']['state']==='pending','stale dialog result ignored');
    file_put_contents($job.'/picker-result.json',json_encode(['id'=>$selectionId,'state'=>'cancelled']));
    ok($service->status($u)['picker']['state']==='cancelled','cancel leaves import untouched');
    file_put_contents($job.'/picker-result.json',json_encode(['id'=>$selectionId,'state'=>'selected','path'=>$source]));
    $public=$service->status($u)['picker'];
    ok($public['state']==='selected'&&$public['fileName']==='fixture.zl.zip'&&!isset($public['path']),'selected file exposes name only');
    refuses(fn()=>$service->command($u,['kind'=>'file-open','selectionId'=>(string)Illuminate\Support\Str::uuid(),'accountId'=>1]),422,'wrong selection ID rejected');
    $other=new User;$other->id=912346;
    refuses(fn()=>$service->command($other,['kind'=>'file-open','selectionId'=>$selectionId,'accountId'=>1]),422,'selection is scoped to owner');
    file_put_contents($job.'/picker.json',json_encode(['id'=>$selectionId,'at'=>time()-1801]));
    refuses(fn()=>$service->command($u,['kind'=>'file-open','selectionId'=>$selectionId,'accountId'=>1]),422,'expired selection rejected');
    file_put_contents($job.'/picker.json',json_encode(['id'=>$selectionId,'at'=>time()]));
    $chosen=$service->command($u,['kind'=>'file-open','selectionId'=>$selectionId,'accountId'=>1]);
    ok($chosen['state']==='needs-unlock','file picker uses existing import flow');
    refuses(fn()=>$service->command($u,['kind'=>'file-open','path'=>$source,'accountId'=>2]),403,'foreign account');
    refuses(fn()=>$service->command($u,['kind'=>'file-open','path'=>$root.'/wrong.txt','accountId'=>1]),422,'invalid source');
    $state=$service->command($u,['kind'=>'file-open','path'=>$source,'accountId'=>1]);
    ok($state['state']==='needs-unlock','file requires key before reading');
    ok($state['uploadLimit']===null,'normal import has no test ceiling');
    ok(!isset($state['source'])&&!isset($state['secret'])&&!isset($state['externalId']),'public status contains no private path or key');
    refuses(fn()=>$service->command($u,['kind'=>'file-unlock','confirm'=>false]),422,'unlock needs explicit confirmation');
    $job=$root.'/app/private/zalo-file-import/'.$owner;
    file_put_contents($job.'/catalog.json',json_encode(['conversations'=>[['conversationId'=>'456']]]));
    refuses(fn()=>$service->command($u,['kind'=>'file-start','conversations'=>['789']]),422,'only catalog conversations allowed');
    $lock=fopen($job.'/worker.lock','c');flock($lock,LOCK_EX);
    refuses(fn()=>$service->command($u,['kind'=>'file-pick','accountId'=>1]),409,'active worker prevents opening picker');
    refuses(fn()=>$service->command($u,['kind'=>'file-open','path'=>$source,'accountId'=>1]),409,'active worker prevents replacing source');
    flock($lock,LOCK_UN);fclose($lock);
    $disk=json_decode(file_get_contents($job.'/state.json'),true);$disk['state']='queued-import';$disk['updatedAt']=1;file_put_contents($job.'/state.json',json_encode($disk));
    ok($service->status($u)['state']==='paused','orphaned queued worker becomes resumable');
    $controller=new App\Http\Controllers\ZaloTeamArchiveController;
    $call=function($host,$ip,$kind)use($controller,$u){$r=Request::create('http://'.$host.'/api/zalo-team/archive','POST',['kind'=>$kind],[],[],['REMOTE_ADDR'=>$ip]);$r->setUserResolver(fn()=>$u);return $controller->command($r,app(ZaloTeamArchive::class),app(ZaloTeamCatalog::class),app(ZaloTeamArchiveBackup::class));};
    refuses(fn()=>$call('localhost','192.168.0.2','file-status'),403,'remote peer rejected');
    refuses(fn()=>$call('example.test','127.0.0.1','file-status'),403,'non-loopback hostname rejected');
    refuses(fn()=>$call('localhost','127.0.0.1','pc-connect'),410,'retired PC workflow rejected');
    ok(is_file($source)&&file_get_contents($source)==='not read before unlock','source untouched');
    echo "PASS $checks file import control checks\n";
} finally {
    if(dirname(realpath($root))!==realpath(sys_get_temp_dir())||!str_starts_with(basename($root),'zt-file-control-'))throw new Exception('Unsafe cleanup');
    File::deleteDirectory($root);
}
