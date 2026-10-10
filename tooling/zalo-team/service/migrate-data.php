<?php
// Explicit operator-only migration. Never exposed as an HTTP route.
require ($base = getenv('ZALO_BACKEND_BASE') ?: __DIR__.'/../../../apps/backend').'/vendor/autoload.php';
$app = require $base.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Services\ZaloTeamArchive;
use App\Services\ZaloTeamRuntime;

$tables = ['zt_workspaces','zt_tags','zt_tag_assignments','zt_tag_imports','zt_tag_audits',
    'zt_archive_settings','zt_archive_sources','zt_archive_messages','zt_archive_observations',
    'zt_archive_assets','zt_archive_backups','zt_archive_checkpoints','zt_archive_imports',
    'zt_archive_versions','zt_phone_sync_jobs','zt_archive_file_retries','zt_archive_pc_recoveries'];
[$mode,$path] = array_slice($argv,1)+[null,null];
if (!$path || !in_array($mode,['export','import','verify'])) throw new RuntimeException('Usage: export|import|verify FILE');
$counts=[];
if ($mode==='export') {
    if (ZaloTeamRuntime::role()!=='combined' || file_exists($path)) throw new RuntimeException('Export requires combined source and new file');
    $f=fopen($path,'xb'); chmod($path,0600);
    $write=function($v)use($f){$s=json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\n";if(fwrite($f,$s)!==strlen($s))throw new RuntimeException('Short write');};
    DB::transaction(function()use($tables,$write,&$counts){
        DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $write(['format'=>'zalo-service-migration/1']);
        $ids=DB::table('zt_archive_settings')->pluck('user_id')->merge(DB::table('zt_tag_imports')->pluck('created_by'))->merge(DB::table('zt_tag_audits')->pluck('actor_id'))->unique();
        foreach($ids as $id){$u=App\Models\User::findOrFail($id);$write(['table'=>'users','row'=>['id'=>$u->id,'zalo_owner'=>ZaloTeamArchive::owner($u)]]);}
        foreach($tables as $t){$counts[$t]=0; foreach(DB::table($t)->orderBy(Schema::hasColumn($t,'id')?'id':'owner')->cursor() as $row){$write(['table'=>$t,'row'=>(array)$row]);$counts[$t]++;}}
        $write(['counts'=>$counts]);
    });
    fflush($f);fsync($f);fclose($f);
} else {
    if(ZaloTeamRuntime::role()!=='zalo') throw new RuntimeException('Destination must be isolated Zalo runtime');
    $f=fopen($path,'rb');$header=json_decode(fgets($f),true,512,JSON_THROW_ON_ERROR);
    if(($header['format']??'')!=='zalo-service-migration/1')throw new RuntimeException('Invalid format');
    DB::transaction(function()use($mode,$tables,$f,&$counts){
        if($mode==='import'){foreach(['users',...$tables] as $t)if(DB::table($t)->exists())throw new RuntimeException('Destination is not empty: '.$t);}
        $expected=null;
        while(($line=fgets($f))!==false){$v=json_decode($line,true,512,JSON_THROW_ON_ERROR);
            if(isset($v['counts'])){$expected=$v['counts'];continue;}
            $t=$v['table'];if(!in_array($t,['users',...$tables],true))throw new RuntimeException('Unknown table');
            if($mode==='import')DB::table($t)->insert($v['row']);
            else { $key=isset($v['row']['id'])?'id':'owner';$row=DB::table($t)->where($key,$v['row'][$key])->first();if(!$row || (array)$row!=$v['row'])throw new RuntimeException('Row mismatch: '.$t); }
            $counts[$t]=($counts[$t]??0)+1;
        }
        if($expected===null)throw new RuntimeException('Truncated export');
        foreach($expected as $t=>$count)if(DB::table($t)->count()!==$count)throw new RuntimeException('Count mismatch: '.$t);
        if($mode==='import')foreach(['users',...$tables] as $t){if(Schema::hasColumn($t,'id')){$seq=DB::selectOne('SELECT pg_get_serial_sequence(?, ?) AS seq',[$t,'id'])->seq;if($seq)DB::select('SELECT setval(?, greatest(coalesce((SELECT max(id) FROM "'.$t.'"), 0),1), (SELECT count(*) > 0 FROM "'.$t.'"))',[$seq]);}}
    }); fclose($f);
}
echo json_encode(['mode'=>$mode,'counts'=>$counts,'sha256'=>hash_file('sha256',$path)],JSON_PRETTY_PRINT)."\n";
