<?php
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app=require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Services\{ZaloTeamFileImportRetry,ZaloTeamImportTransportException,ZaloTeamPcRemote};
use Illuminate\Support\Facades\Http;
$key=tempnam(sys_get_temp_dir(),'zt-retry-');file_put_contents($key,str_repeat('a',64));
config(['zalo_team.service_key_file'=>$key,'zalo_team.remote_api_url'=>'https://archive.test/api']);
Http::preventStrayRequests();
$retry=new class extends ZaloTeamFileImportRetry {
    protected function wait(int $seconds,callable $pulse):void {$pulse();}
};
$checks=0;
function ok($v,$label){global $checks;if(!$v)throw new Exception($label);$checks++;}
function respond($fn){Http::swap(new Illuminate\Http\Client\Factory);Http::preventStrayRequests();Http::fake(['archive.test/*'=>$fn]);}
$user=new App\Models\User;$user->id=1;$remote=new ZaloTeamPcRemote;
try {
    $calls=0;$states=[];$pulses=0;
    respond(function()use(&$calls){return ++$calls<3?Http::response([],409):Http::response(['ok'=>true]);});
    $r=$retry->run(fn()=>$remote->call($user,'commit'),function()use(&$pulses){$pulses++;},function($s)use(&$states){$states[]=$s;});
    ok($r['ok'] && $calls===3,'busy archive automatically resumes');
    ok($states[0]['reason']==='PC_ARCHIVE_BUSY' && $states[1]['seconds']===2 && end($states)===null,'retry progress and bounded backoff');
    ok($pulses>=5,'wait responds to stop heartbeat');
    $calls=0;respond(function()use(&$calls){$calls++;return Http::response([],403);});
    try{$retry->run(fn()=>$remote->call($user,'commit'),fn()=>null,fn($s)=>null);throw new Exception('accepted');}catch(ZaloTeamImportTransportException $e){ok(!$e->retryable && $calls===1 && $e->getMessage()==='PC_REMOTE_UNAUTHORIZED','revoked access never retries');}
    respond(fn()=>Http::response(['code'=>'PC_MESSAGES_CHECKSUM_MISMATCH'],422));
    try{$retry->run(fn()=>$remote->call($user,'commit'),fn()=>null,fn($s)=>null);throw new Exception('accepted');}catch(ZaloTeamImportTransportException $e){ok(!$e->retryable && $e->getMessage()==='PC_MESSAGES_CHECKSUM_MISMATCH','integrity errors retained and not retried');}
    $calls=0;respond(function()use(&$calls){$calls++;return Http::response([],503);});
    try{$retry->run(fn()=>$remote->call($user,'file-plan'),fn()=>null,fn($s)=>null,3);throw new Exception('accepted');}catch(ZaloTeamImportTransportException $e){ok($calls===3 && $e->httpStatus===503,'network outage bounded');}
    $pulses=0;
    try{$retry->run(fn()=>$remote->call($user,'commit'),function()use(&$pulses){if(++$pulses===2)throw new RuntimeException('FILE_STOPPED');},fn($s)=>null);throw new Exception('accepted');}catch(RuntimeException $e){ok($e->getMessage()==='FILE_STOPPED','stop interrupts wait immediately');}
    respond(fn()=>throw new Illuminate\Http\Client\ConnectionException('simulated'));
    try{$remote->call($user,'file-plan');throw new Exception('accepted');}catch(ZaloTeamImportTransportException $e){ok($e->retryable && $e->getMessage()==='PC_REMOTE_NETWORK','transport loss classified');}
    echo "PASS $checks file transport retry checks\n";
} finally {unlink($key);}
