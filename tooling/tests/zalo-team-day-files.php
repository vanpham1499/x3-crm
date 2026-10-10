<?php
// Isolated in-memory DB. No Zalo/network calls or writes to the real archive.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use App\Models\User;
use App\Services\ZaloTeamArchive;
use App\Services\ZaloTeamArchiveReport;
config(['database.default'=>'day_files_test','database.connections.day_files_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'','foreign_key_constraints'=>true],
    'zalo_team.remote_api_url'=>null,'zalo_team.maintenance'=>false]);
DB::purge('day_files_test');
if (DB::connection()->getDatabaseName() !== ':memory:') throw new Exception('Unsafe test DB');
Schema::create('users',fn(Blueprint $t)=>$t->id());
DB::table('users')->insert([['id'=>1],['id'=>2]]);
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_03_000200_create_zalo_team_archive.php')->up();
$u=new User; $u->id=1; $other=new User; $other->id=2;
$owner=ZaloTeamArchive::owner($u); $otherOwner=ZaloTeamArchive::owner($other);
DB::table('zt_archive_settings')->insert(['owner'=>$owner,'user_id'=>1,'accounts'=>'[1,2]']);
foreach ([['a',$owner,1,'Duy'],['b',$owner,2,'Ánh'],['c',$otherOwner,1,'Private']] as [$id,$scope,$account,$name]) {
    DB::table('zt_archive_sources')->insert(['id'=>$id,'owner'=>$scope,'account_id'=>$account,'external_id'=>(string)$account,'conversation_id'=>'g'.$account,'canonical'=>'group','name'=>'Nhóm kiểm thử','account_name'=>$name]);
}
$start=Carbon\CarbonImmutable::parse('2026-10-07','Asia/Ho_Chi_Minh')->startOfDay()->getTimestampMs();
function fixture(string $id,int $time,string $state='error',array $sources=['a'],bool $deleted=false): string {
    global $owner,$otherOwner;
    $scope=$sources===['c']?$otherOwner:$owner;
    DB::table('zt_archive_messages')->insert(['id'=>$id,'owner'=>$scope,'canonical'=>'group','native_id'=>$id,'time'=>$time,'content'=>json_encode(['attachments'=>[['name'=>'Biểu mẫu.pdf','kind'=>'file','url'=>'https://private.example/secret']]])]);
    DB::table('zt_archive_assets')->insert(['id'=>$id,'owner'=>$scope,'message_id'=>$id,'slot'=>'attachments.0.url','url'=>'https://private.example/secret','state'=>$state,'error'=>'HTTP 404','attempts'=>5]);
    foreach ($sources as $source) DB::table('zt_archive_observations')->insert(['id'=>$id.$source,'source_id'=>$source,'message_id'=>$id,'native_id'=>$id,'deleted'=>$deleted,'observed_at'=>now(),'view'=>json_encode(['mine'=>$source==='a','sender'=>['name'=>'Người gửi thử']])]);
    return $id;
}
fixture('start',$start,'error',['a','b']);
fixture('end',$start+86399999);
fixture('before',$start-1);
fixture('after',$start+86400000);
fixture('pending',$start+1,'pending');
fixture('ready',$start+2,'ready');
fixture('dismissed',$start+3,'dismissed');
fixture('hidden',$start+4,'error',['a'],true);
fixture('foreign',$start+5,'error',['c']);
DB::table('zt_archive_assets')->insert(['id'=>'preview','owner'=>$owner,'message_id'=>'start','slot'=>'attachments.0.preview','url'=>'','state'=>'error','error'=>'preview only']);
$report=new ZaloTeamArchiveReport; $checks=0;
function check(bool $ok,string $why):void { global $checks; if(!$ok)throw new Exception($why);$checks++; }
$result=$report->dayFileIssues($u,'2026-10-07');
check($result['total']===2,'Vietnam day excludes neighboring days, preview, pending, ready, dismissed, hidden and other owners');
check($report->days($u,null,'2026-10-07')['days'][0]['failed']===$result['total'],'detail total matches daily failed originals');
check(array_column($result['items'],'id')===['end','start'],'stable descending timestamp order');
check(count($result['items'][1]['sources'])===2,'shared attachment counted once with both authorized origins');
check($result['items'][1]['sources'][0]['senderName']==='Duy (Bạn)','mine displayed for its own account');
check($result['items'][1]['sources'][1]['senderName']==='Người gửi thử','sender follows account observation');
$filtered=$report->dayFileIssues($u,'2026-10-07',2);
check($filtered['total']===1 && count($filtered['items'][0]['sources'])===1 && $filtered['items'][0]['sources'][0]['accountName']==='Ánh','account filter scopes both count and origins');
check($report->dayFileIssues($u,'2026-10-07',99)['total']===0,'unavailable account returns no details');
check($report->dayFileIssues($other,'2026-10-07')['total']===1,'other owner sees only own data');
check(!str_contains(json_encode($result),'private.example') && !str_contains(json_encode($result),'"view"'),'no raw URLs or snapshots leaked');
DB::table('zt_archive_observations')->where('id','startb')->update(['deleted'=>true]);
check($report->dayFileIssues($u,'2026-10-07',2)['total']===0,'hidden observation never leaks through shared canonical message');
check(count($report->dayFileIssues($u,'2026-10-07')['items'][1]['sources'])===1,'hidden origin removed');
for($i=0;$i<52;$i++) fixture('page'.$i,$start+86400000+1+$i);
$page1=$report->dayFileIssues($u,'2026-10-08');$page2=$report->dayFileIssues($u,'2026-10-08',null,$page1['nextOffset']);
check($page1['total']===53 && count($page1['items'])===50 && count($page2['items'])===3 && $page2['nextOffset']===null,'bounded pagination covers all files');
check(!array_intersect(array_column($page1['items'],'id'),array_column($page2['items'],'id')),'no duplicate pagination rows');
$controller=new App\Http\Controllers\ZaloTeamArchiveController;
$request=Illuminate\Http\Request::create('/api/zalo-team/archive','POST',['kind'=>'day-file-issues','date'=>'2026-10-07','accountId'=>1]);$request->setUserResolver(fn()=>$u);
$response=$controller->command($request,app(ZaloTeamArchive::class),app(App\Services\ZaloTeamCatalog::class),app(App\Services\ZaloTeamArchiveBackup::class))->getData(true);
check($response['total']===2,'API read command registered and scoped');
foreach([null,'invalid','2026-02-30'] as $date) {
    $request=Illuminate\Http\Request::create('/api/zalo-team/archive','POST',['kind'=>'day-file-issues','date'=>$date]);$request->setUserResolver(fn()=>$u);
    try {$controller->command($request,app(ZaloTeamArchive::class),app(App\Services\ZaloTeamCatalog::class),app(App\Services\ZaloTeamArchiveBackup::class));throw new Exception('Expected date rejection');}
    catch(Illuminate\Validation\ValidationException){$checks++;}
}
echo "PASS $checks daily file checks\n";
