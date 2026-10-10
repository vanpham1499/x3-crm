<?php
// Synthetic disposable SQLite (default) or opt-in loopback PostgreSQL. No external requests or customer writes.
putenv('ZALO_TEAM_RUNTIME=zalo');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function(Throwable $e) { fwrite(STDERR, 'FAIL: '.$e->getMessage()."\n"); exit(1); });
use Illuminate\Support\Facades\{DB, Schema, Http};
use Illuminate\Database\Schema\Blueprint;
use App\Services\{ZaloTeamArchive, ZaloTeamArchiveReport, ZaloTeamArchiveSearch};
use App\Models\ZaloTeamIdentityUser;
$owner = str_repeat('a', 64);
$sourceCount = in_array('--large', $argv, true) ? 1000 : 100;
$messageCount = in_array('--large', $argv, true) ? 100000 : 1200;
if (in_array('--baseline', $argv, true)) {
    foreach (['ZaloTeamArchive','ZaloTeamArchiveReport','ZaloTeamArchiveSearch'] as $class)
        require __DIR__.'/../../.local/phase-b-before/apps/backend/app/Services/'.$class.'.php';
}
config(['database.default'=>'read_perf', 'database.connections.read_perf'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>''],
    'zalo_team.storage_owner'=>$owner, 'zalo_team.workspace'=>'test', 'zalo_team.drive.enabled'=>true,
    'zalo_team.archive_path'=>sys_get_temp_dir().'/zt-perf-no-files-'.bin2hex(random_bytes(8))]);
Http::preventStrayRequests();
// Opt-in loopback container, fixed disposable database name; never use app DB settings.
if (getenv('ZT_READ_TEST_PG_PORT')) config(['database.connections.read_perf'=>[
    'driver'=>'pgsql','host'=>'127.0.0.1','port'=>(int)getenv('ZT_READ_TEST_PG_PORT'),
    'database'=>'zalo_phase_b_fixture','username'=>'fixture','password'=>'fixture-only', 'charset'=>'utf8','prefix'=>'','search_path'=>'public','sslmode'=>'prefer']]);
if (!in_array('--reuse-fixture',$argv,true)) {
Schema::create('users', fn(Blueprint $t)=>$t->id());
DB::table('users')->insert(['id'=>1]);
foreach (['2026_10_03_000200_create_zalo_team_archive','2026_10_03_000202_create_zalo_archive_checkpoints',
    '2026_10_03_000203_add_zalo_archive_progress','2026_10_03_000204_create_zalo_archive_imports',
    '2026_10_04_000208_create_zalo_archive_pc_recoveries','2026_10_04_000209_add_pc_recovery_source_state',
    '2026_10_07_000210_create_zalo_archive_drive_objects'] as $migration) {
    (require __DIR__.'/../../apps/backend/database/migrations/'.$migration.'.php')->up();
}
}
$u = new ZaloTeamIdentityUser;
$u->forceFill(['id'=>1,'is_active'=>true,'zalo_access'=>['admin'=>true,'owner'=>$owner,'accounts'=>[]]]);
$archive = new ZaloTeamArchive;
$archive->settings($u);
$sources=[]; $messages=[]; $observations=[]; $assets=[];
function flushRows(array &$sources,array &$messages,array &$observations,array &$assets): void {
    foreach (['sources'=>$sources,'messages'=>$messages,'observations'=>$observations,'assets'=>$assets] as $table=>$rows)
        foreach(array_chunk($rows,50) as $chunk) DB::table('zt_archive_'.$table)->insert($chunk);
    $sources=$messages=$observations=$assets=[];
}
if (!in_array('--reuse-fixture',$argv,true)) {
for ($i=0; $i<$messageCount; $i++) {
    $source=hash('sha256','source'.($i%$sourceCount)); $id=hash('sha256','message'.$i);
    if ($i<$sourceCount) $sources[]=['id'=>$source,'owner'=>$owner,'account_id'=>$i<$sourceCount/2?1:2,'external_id'=>(string)($i<$sourceCount/2?101:102),
        'conversation_id'=>'g'.$i,'canonical'=>'group'.$i,'name'=>'Nhóm '.$i,'account_name'=>'Test','latest'=>1791500000000];
    $messages[]=['id'=>$id,'owner'=>$owner,'canonical'=>'group'.($i%$sourceCount),'native_id'=>(string)$i,
        'time'=>1791500000000-(($i%120)*86400000),
        'content'=>json_encode(['id'=>(string)$i,'time'=>1791500000000,'text'=>'Fixture', 'attachments'=>[['kind'=>'image','url'=>'https://test.invalid/image']]])];
    $observations[]=['id'=>hash('sha256','observation'.$i),'source_id'=>$source,'message_id'=>$id,'native_id'=>(string)$i,
        'view'=>json_encode(['sender'=>['id'=>'7','name'=>'Test','avatarSrc'=>'https://test.invalid/avatar']]),'observed_at'=>now()];
    $assets[]=['id'=>hash('sha256','asset'.$i),'owner'=>$owner,'message_id'=>$id,'slot'=>'attachments.0.url',
        'url'=>'https://test.invalid/image','hash'=>hash('sha256','blob'.$i),'bytes'=>1024,'state'=>$i%60===0?'error':'ready'];
    if (($i+1)%500===0) flushRows($sources,$messages,$observations,$assets);
}
flushRows($sources,$messages,$observations,$assets);
}
if (DB::table('zt_archive_messages')->count() !== $messageCount) throw new RuntimeException('Fixture size mismatch');
DB::statement('ANALYZE'); // Bulk fixtures need planner statistics, as a populated service database does.
fwrite(STDERR, "Fixture ready: $messageCount messages\n");
if (in_array('--trace',$argv,true)) DB::listen(fn($q)=>fwrite(STDERR, round($q->time,2).' ms '.substr($q->sql,0,350)."\n"));
function measure(callable $work): array {
    static $sequence=0;
    fwrite(STDERR, 'Measure '.++$sequence."\n");
    $times=[]; $queries=0; $bytes=0;
    $once = in_array('--once', $_SERVER['argv'], true);
    if (!$once) $work(); // Warm the same dataset before measuring.
    for($i=0;$i<($once ? 1 : 7);$i++) {
        DB::flushQueryLog(); DB::enableQueryLog(); $start=hrtime(true);
        $result=$work(); $times[]=(hrtime(true)-$start)/1e6;
        if (in_array('--large', $_SERVER['argv'], true)) fwrite(STDERR, 'Sample '.($i+1).': '.round(end($times),2)." ms\n");
        $queries=count(DB::getQueryLog()); DB::disableQueryLog(); $bytes=strlen(json_encode($result));
    }
    sort($times);
    return ['samples'=>count($times),'p50Ms'=>round($times[(int)floor(count($times)/2)],2),'p95Ms'=>round(end($times),2),'queries'=>$queries,'responseBytes'=>$bytes];
}
$report=new ZaloTeamArchiveReport; $search=new ZaloTeamArchiveSearch;
$results=['dataset'=>['sources'=>$sourceCount,'messages'=>$messageCount,'assets'=>$messageCount,'days'=>120],
    'status'=>measure(fn()=>$archive->status($u)),
    'days'=>measure(fn()=>$report->days($u)),
    'search50'=>measure(fn()=>$search->conversations($u,'nhom')),
    'media50'=>measure(fn()=>$archive->attachmentStatus($u,1,'g0',array_map('strval',range(0,min($messageCount - $sourceCount,49*$sourceCount),$sourceCount))))];
if (in_array('--optimized',$argv,true)) {
    $results['statusSync']=measure(fn()=>$archive->status($u,'sync'));
    $results['statusBackup']=measure(fn()=>$archive->status($u,'backup'));
    $results['statusStorage']=measure(fn()=>$archive->status($u,'storage'));
    $results['daysPage']=measure(fn()=>$report->days($u,null,null,0,14));
}
echo json_encode($results,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n";

if (in_array('--check', $argv, true)) {
    $checks=0;
    $check=function($condition,$label) use (&$checks) { if (!$condition) throw new RuntimeException($label); $checks++; };
    $all=$report->days($u)['days']; $paged=[];
    for($offset=0;$offset<count($all);$offset+=14) {
        $r=$report->days($u,null,null,$offset,14);
        $check($r['pagination']['total']===count($all), 'daily total is global');
        $paged=array_merge($paged,$r['days']);
    }
    $check($all===$paged,'daily pagination preserves counts, order and all dates');
    $check($all[0]['date']==='2026-10-09', 'daily grouping uses Vietnam date');
    $check($report->days($u,null,$all[0]['date'],0,14)['days']===[$all[0]],'date filtering is applied before pagination');
    $check($report->days($u,null,'2000-01-01',0,14)['days']===[], 'empty date stays empty');
    $scoped=clone $u; $scoped->setAttribute('zalo_access',['admin'=>false,'owner'=>$owner,'accounts'=>[1=>['read'=>true]]]);
    $none=clone $u; $none->setAttribute('zalo_access',['admin'=>false,'owner'=>$owner,'accounts'=>[]]);
    $check($report->days($none,null,null,0,14)['pagination']['total']===0,'no ACL produces no day counts');
    $check($report->days($scoped,2,null,0,14)['days']===[],'account filter cannot expand ACL');
    $searchRows=$search->conversations($scoped,'nhom')['conversations'];
    $check(count($searchRows)===50 && count(array_filter($searchRows,fn($r)=>$r['accountId']!==1))===0,'search respects ACL and Vietnamese normalization');
    $check($search->conversations($none,'nhom')['conversations']===[],'no ACL produces no search results');
    $first=$search->listing($u); $second=$search->listing($u,null,50);
    $check($first['nextOffset']===50 && $second['nextOffset']===null,'search pagination reaches last page');
    $check(count(array_unique(array_column(array_merge($first['conversations'],$second['conversations']),'id')))===100,'no search duplicates at page boundary');
    $check($results['search50']['queries']<=3 && $results['media50']['queries']<=4,'query budget stays bounded');
    $check($archive->status($u,'storage')['stats']===$archive->status($u)['stats'],'thin storage keeps full statistics');
    $check($archive->status($u,'backup')['sources']->isEmpty(),'backup does not load source catalog');
    $check($archive->status($u,'sync')['fileIssues']->isEmpty(),'collapsed issues are not queried');
    $check($archive->status($u,'sync',true)['fileIssues']->count()===20,'expanded issues still return the latest twenty');
    $check($report->days($u,null,$all[0]['date'],0,14,false)['sources']===[],'filtered day list does not fetch unopened source detail');
    $check($report->days($u,null,null,99999,14)['pagination']['offset']===112,'daily page clamps after data shrinks');
    $restricted=$archive->status($scoped,'sync');
    $check($restricted['backups']===[] && $restricted['imports']===[] && $restricted['storage']===[] && $restricted['pcRecovery']===null,'thin status retains role restrictions');
    $assets=DB::table('zt_archive_assets')->where('state','ready')->limit(4)->get();
    foreach($assets as $i=>$a) DB::table('zt_archive_drive_objects')->insert([
        'id'=>hash('sha256',$owner.'|archive|'.$a->hash),'owner'=>$owner,'kind'=>'archive','object_key'=>$a->hash,
        'checksum'=>$i===2?str_repeat('f',64):$a->hash,'bytes'=>$i===3?999:$a->bytes,'state'=>$i===1?'pending':'verified',
        'folder_id'=>'test','shared_drive_id'=>'test','created_at'=>now(),'updated_at'=>now()]);
    $store=app(App\Services\ZaloTeamDriveStore::class);
    $availability=$store->availableAssets($assets);
    foreach($assets as $i=>$a) {
        $check($availability[$a->id]===($i===0),'only verified matching hash and bytes are available');
        $check($availability[$a->id]===$store->available($a->owner,$a->hash,(int)$a->bytes),'batch preserves single-file availability');
    }
    $other=clone $assets[0]; $other->owner=str_repeat('b',64); $other->id='another-owner';
    $check(!$store->availableAssets([$other])[$other->id],'availability cannot cross owners');
    $media=app(App\Services\ZaloTeamArchiveDetail::class)->read($u,['kind'=>'media-library','accountId'=>1,'conversationId'=>'g0']);
    $check(count($media['items'])===12 && !isset($media['items'][0]['_archiveMessage']),'media batch preserves public projection');
    $summary=$report->fileSummary($owner,$u);
    $check($summary['retryDue']===20 && $summary['failed']===20,'retry aggregates count due errors');
    $retryAsset=DB::table('zt_archive_assets')->where('state','error')->first();
    $future=now()->addHours(2);
    DB::table('zt_archive_assets')->where('id',$retryAsset->id)->update(['retry_at'=>$future]);
    $summary=$report->fileSummary($owner,$u);
    $check($summary['retryDue']===19 && Carbon\CarbonImmutable::parse($summary['nextRetryAt'])->equalTo($future->startOfSecond()),'future retry timestamp is preserved');
    $stats=$archive->status($u,'storage')['stats'];
    $observation=(array)DB::table('zt_archive_observations')->first();
    $observation['id']=hash('sha256','duplicate-observation');$observation['native_id']='duplicate';
    $observation['source_id']=DB::table('zt_archive_sources')->where('id','!=',$observation['source_id'])->value('id');
    DB::table('zt_archive_observations')->insert($observation);
    $check($archive->status($u,'storage')['stats']['bytes']===$stats['bytes'],'multiple account observations do not multiply blob totals');
    echo "PASS $checks read regression checks; no external requests\n";
}
