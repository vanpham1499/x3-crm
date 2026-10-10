<?php
putenv('ZALO_TEAM_REMOTE_API_URL=');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app=require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function(Throwable $e){fwrite(STDERR,'FAIL: '.$e->getMessage()."\n");exit(1);});
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use App\Services\{ZaloTeamArchive,ZaloTeamArchiveFiles,ZaloTeamArchiveBackup,ZaloTeamDriveClient,ZaloTeamDriveStore};
$root=sys_get_temp_dir().'/zt-drive-restore-'.bin2hex(random_bytes(8));
config(['database.default'=>'drive_restore_test','database.connections.drive_restore_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'','foreign_key_constraints'=>true],
    'zalo_team.archive_path'=>$root.'/archive','zalo_team.backup_path'=>$root.'/backup','zalo_team.backup_password'=>str_repeat('test-key',8),'zalo_team.workspace'=>'test','zalo_team.drive.enabled'=>false,
    'zalo_team.drive.folder_id'=>'folder-test','zalo_team.drive.shared_drive_id'=>'drive-test']);
DB::purge('drive_restore_test');
if(DB::connection()->getDatabaseName()!==':memory:')throw new Exception('Unsafe test DB');
Schema::create('users',function(Blueprint $t){$t->id();});
Schema::create('zt_tags',function(Blueprint $t){$t->string('id');});
Schema::create('zt_tag_assignments',function(Blueprint $t){$t->string('workspace');$t->string('source');$t->string('tag_id');});
DB::table('users')->insert(['id'=>1]);
foreach(['2026_10_03_000200_create_zalo_team_archive','2026_10_03_000202_create_zalo_archive_checkpoints','2026_10_03_000203_add_zalo_archive_progress','2026_10_03_000204_create_zalo_archive_imports','2026_10_03_000205_create_zalo_archive_versions','2026_10_03_000207_create_zalo_archive_file_retries','2026_10_04_000208_create_zalo_archive_pc_recoveries','2026_10_04_000209_add_pc_recovery_source_state','2026_10_07_000210_create_zalo_archive_drive_objects'] as $m){(require __DIR__.'/../../apps/backend/database/migrations/'.$m.'.php')->up();}
$checks=0;
function check($ok,$why){global $checks;if(!$ok)throw new Exception($why);$checks++;}
$client=new class extends ZaloTeamDriveClient {
    public array $bytes=[],$meta=[],$sessions=[];public int $count=0;
    public function destination():array{return [];}
    public function allocate():string{return 'fixture-'.++$this->count;}
    public function metadata(string $id):?array{return $this->meta[$id]??null;}
    public function start(object $o):string{$this->sessions[$o->drive_id]=clone $o;$this->bytes[$o->drive_id]='';return $o->drive_id;}
    public function small(object $o,string $bytes):array{$id=$this->start($o);$this->chunk($id,$bytes,0,strlen($bytes));return $this->meta[$id];}
    public function probe(string $uri,int $size):array{return ['expired'=>false,'offset'=>strlen($this->bytes[$uri])];}
    public function chunk(string $uri,string $bytes,int $offset,int $size):array{
        $this->bytes[$uri].=$bytes;$o=$this->sessions[$uri];
        $this->meta[$uri]=['id'=>$uri,'size'=>$size,'sha256Checksum'=>hash('sha256',$this->bytes[$uri]),'driveId'=>'drive-test','parents'=>['folder-test'],
            'capabilities'=>['canDelete'=>false,'canTrash'=>false],'appProperties'=>['owner'=>$o->owner,'kind'=>$o->kind,'key'=>$o->object_key,'sha256'=>$o->checksum]];
        return ['expired'=>false,'offset'=>strlen($this->bytes[$uri])];
    }
    public function download(string $id,string $path,int $size):void{file_put_contents($path,$this->bytes[$id]);}
    public function catalog(?string $cursor=null):array{return ['files'=>array_values($this->meta)];}
};
try{
    $u=new App\Models\User;$u->id=1;$owner=ZaloTeamArchive::owner($u);
    $a=new ZaloTeamArchive;$f=new ZaloTeamArchiveFiles;$b=new ZaloTeamArchiveBackup($a,$f);
    $accounts=[['id'=>1,'externalId'=>'123','name'=>'Test','status'=>'connected']];
    $a->configure($u,['enabled'=>false,'media'=>true,'daily_backup'=>false,'accounts'=>[1]],$accounts);
    $source=$a->catalog($u,['accounts'=>$accounts],['conversations'=>[['accountId'=>1,'conversationId'=>'456','name'=>'Fixture']],'groups'=>[]])[0];
    $a->ingest($source,['accountId'=>1,'conversationId'=>'456','messages'=>[['id'=>'123456','clientId'=>'789','time'=>1780000000123,'type'=>'MSG_TEXT','kind'=>'text','text'=>'Private test fixture','mine'=>true,'sender'=>['id'=>'123','name'=>'Test'],'attachments'=>[['kind'=>'image','name'=>'fixture.png','url'=>'https://photo.zdn.vn/fixture']],'quote'=>null]]]);
    $content='fixture binary bytes';$hash=hash('sha256',$content);$path=$f->path($owner,$hash);mkdir(dirname($path),0700,true);file_put_contents($path,$content);
    DB::table('zt_archive_assets')->update(['state'=>'ready','hash'=>$hash,'bytes'=>strlen($content),'mime'=>'image/png']);
    $backup=$b->request($u);$b->create($u,$backup);check($b->verify($u,$backup)['files']===1,'Baseline backup valid');
    config(['zalo_team.drive.enabled'=>true]);$store=new ZaloTeamDriveStore($client);$app->instance(ZaloTeamDriveStore::class,$store);
    config(['zalo_team.drive.excluded_accounts'=>['123'],'zalo_team.drive.backups_after'=>now()->addDay()->toISOString()]);
    check($store->scan()===0,'Excluded test account and older backup never enter automatic queue');
    config(['zalo_team.drive.excluded_accounts'=>['old-test-account'],'zalo_team.drive.backups_after'=>null]);
    check($store->scan()===3,'Queues archive, encrypted blob and encrypted manifest');
    foreach(DB::table('zt_archive_drive_objects')->get() as $o){check($store->transfer($o->id),'Verified remote object');unlink($store->path($owner,$o->kind,$o->object_key));}
    check($a->history($u,$source->id)['messages'][0]['attachments'][0]['archiveState']==='ready','Cold assets still render stored badge');
    DB::table('zt_archive_drive_objects')->delete();
    check($store->recoverCatalog($owner)===3,'Recover all locators after DB metadata loss');
    DB::table('zt_archive_backups')->delete();
    $b->discover($u,$backup);check($b->verify($u,$backup)['files']===1,'Discover and verify encrypted snapshot entirely from Drive');
    DB::table('zt_archive_observations')->delete();DB::table('zt_archive_assets')->delete();DB::table('zt_archive_messages')->delete();
    $b->restore($u,$backup);
    check(DB::table('zt_archive_messages')->count()===1,'Restore message rows');
    check(is_file($path)&&hash_file('sha256',$path)===$hash,'Restore original blob from encrypted backup');
    check($a->history($u,$source->id)['messages'][0]['text']==='Private test fixture','Restored chat readable');
    $before=$client->count;$b->restore($u,$backup);check(DB::table('zt_archive_messages')->count()===1&&$client->count===$before,'Restore replay adds no duplicate rows or Drive objects');
    DB::table('zt_archive_drive_objects')->where('kind','archive')->update(['state'=>'deferred']);
    check($store->scan()===1,'A new allowed account can reactivate the same content hash');
    $r=DB::table('zt_archive_drive_objects')->where('kind','archive')->first();
    check($store->transfer($r->id)&&$client->count===$before,'Deferred upload retains the original Drive ID');
    echo "PASS $checks Drive archive restore checks\n";
}finally{
    $resolved=realpath($root);$temp=realpath(sys_get_temp_dir());
    if($resolved&&str_starts_with($resolved,$temp.DIRECTORY_SEPARATOR)&&str_starts_with(basename($resolved),'zt-drive-restore-')){
        $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($resolved,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($resolved);
    }
}
