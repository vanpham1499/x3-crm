<?php
// Isolated SQLite + temp files + simulated Drive transport; never touches live data.
putenv('ZALO_TEAM_REMOTE_API_URL=');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function(Throwable $e) { fwrite(STDERR, 'FAIL: '.$e->getMessage()."\n"); exit(1); });
use App\Services\ZaloTeamDriveClient;
use App\Services\ZaloTeamDriveStore;
use App\Services\ZaloTeamArchiveFiles;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Http;
use Illuminate\Database\Schema\Blueprint;

$root = sys_get_temp_dir().'/zt-drive-test-'.bin2hex(random_bytes(6));
config(['database.default' => 'drive_test', 'database.connections.drive_test' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true],
    'zalo_team.archive_path' => $root.'/archive', 'zalo_team.backup_path' => $root.'/backup', 'zalo_team.drive.enabled' => true,
    'zalo_team.drive.folder_id' => 'test-folder', 'zalo_team.drive.shared_drive_id' => 'test-drive', 'zalo_team.drive.evict' => false,
    'zalo_team.drive.cache_bytes' => 1048576]);
DB::purge('drive_test');
if (DB::connection()->getDatabaseName() !== ':memory:') { throw new Exception('Unsafe test DB'); }
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_07_000210_create_zalo_archive_drive_objects.php')->up();
Schema::create('zt_archive_assets', function (Blueprint $t) { $t->string('owner'); $t->string('hash'); $t->string('slot'); $t->string('state'); });
Schema::create('zt_archive_backups', function (Blueprint $t) { $t->string('id'); $t->string('owner'); $t->string('state'); $t->timestamp('created_at'); });
$checks = 0;
function check($ok, $message) { global $checks; if (!$ok) { throw new Exception($message); } $checks++; }
function expectError(callable $fn, string $code) { try { $fn(); } catch (Throwable $e) { check($e->getMessage() === $code, 'Wrong error '.$e->getMessage()); return; } throw new Exception('Expected '.$code); }
$fake = new class extends ZaloTeamDriveClient {
    public array $data = [], $meta = [], $sessions = [];
    public int $allocations = 0, $starts = 0, $downloads = 0;
    public bool $lostAck = false, $wrongHash = false, $corruptDownload = false, $deleteAllowed = false;
    public function destination(): array { if($this->deleteAllowed) throw new RuntimeException('drive_delete_permission_present'); return []; }
    public function allocate(): string { return 'file-'.(++$this->allocations); }
    public function metadata(string $id): ?array { return $this->meta[$id] ?? null; }
    public function start(object $o): string { $this->starts++; $this->sessions[$o->drive_id] = clone $o; $this->data[$o->drive_id] = ''; return $o->drive_id; }
    public function small(object $o, string $bytes): array { $id=$this->start($o); $this->chunk($id,$bytes,0,strlen($bytes)); return $this->meta[$id]; }
    public function probe(string $uri, int $size): array { return ['expired' => !isset($this->data[$uri]), 'offset' => strlen($this->data[$uri] ?? '')]; }
    public function chunk(string $uri, string $bytes, int $offset, int $size): array {
        check(strlen($this->data[$uri]) === $offset, 'Resume offset must match confirmed server offset');
        $this->data[$uri] .= $bytes;
        if (strlen($this->data[$uri]) === $size) {
            $o = $this->sessions[$uri];
            $this->meta[$uri] = ['id' => $uri, 'size' => (string)$size, 'sha256Checksum' => $this->wrongHash ? str_repeat('0',64) : hash('sha256',$this->data[$uri]),
                'driveId' => 'test-drive', 'parents' => ['test-folder'], 'capabilities'=>['canDelete'=>false,'canTrash'=>false], 'appProperties' => ['owner'=>$o->owner,'kind'=>$o->kind,'key'=>$o->object_key,'sha256'=>$o->checksum]];
        }
        if ($this->lostAck) { $this->lostAck = false; throw new RuntimeException('connection secret-url must be redacted'); }
        return ['expired' => false, 'offset' => strlen($this->data[$uri])];
    }
    public function download(string $id,string $path,int $size): void { $this->downloads++; file_put_contents($path, $this->corruptDownload ? str_repeat('x',$size) : $this->data[$id]); }
    public function catalog(?string $cursor=null):array { return ['files'=>array_values($this->meta)]; }
};
$store = new ZaloTeamDriveStore($fake);
$app->instance(ZaloTeamDriveStore::class, $store);
$owner = str_repeat('a',64); $other = str_repeat('b',64);
function blob(string $content, string $owner, string $kind='archive', ?string $key=null): array {
    global $store;
    $hash=hash('sha256',$content); $key ??= $hash; $path=$store->path($owner,$kind,$key);
    if(!is_dir(dirname($path)))mkdir(dirname($path),0700,true);
    file_put_contents($path,$content); $store->queue($owner,$kind,$key);
    $row=DB::table('zt_archive_drive_objects')->where('owner',$owner)->where('kind',$kind)->where('object_key',$key)->first();
    return [$path,$hash,$row->id];
}
try {
    [$path,$hash,$id]=blob(str_repeat('test-file-',1000000),$owner);
    $fake->lostAck=true;
    check(!$store->transfer($id),'Lost response yields retry');
    $row=DB::table('zt_archive_drive_objects')->find($id);
    check($row->state==='error' && $row->uploaded===0,'Unacknowledged bytes not marked durable');
    check($row->error==='drive_connection_failed','Never expose URLs or credentials');
    check(is_file($path),'Failure preserves local source');
    check(!str_contains($row->upload_session,'file-1'),'Resumable bearer URI encrypted');
    check($store->transfer($id),'Resume succeeds');
    check($fake->allocations===1 && $fake->starts===1,'Stable file ID prevents duplicates');
    check(!$store->queue($owner,'archive',$hash),'Repeated archive queues once');
    check($store->transfer($id) && $fake->starts===1,'Verified replay skips upload');
    check($store->available($owner,$hash,filesize($path)),'Verified file available');
    check(!$store->available($other,$hash,filesize($path)),'Other owner cannot access remote locator');
    // Confirm a cold read verifies bytes and restores the private path.
    unlink($path);
    check($store->available($owner,$hash,10000000),'Cold archive still listed as stored');
    check($store->read($owner,'archive',$hash)===$path && hash_file('sha256',$path)===$hash,'Cold read downloads and verifies');
    $count=$fake->downloads; $store->read($owner,'archive',$hash);
    check($fake->downloads===$count,'Warm cache skips network');
    unlink($path); $fake->corruptDownload=true;
    expectError(fn()=>$store->read($owner,'archive',$hash),'drive_checksum_mismatch');
    check(!is_file($path),'Corrupt download never published');
    $fake->corruptDownload=false; $store->read($owner,'archive',$hash);
    check($store->evict()===0,'Eviction disabled by default');
    config(['zalo_team.drive.evict'=>true]);
    check($store->evict()===0,'Active response/cache pin prevents eviction');
    touch($path,time()-7200);
    DB::table('zt_archive_drive_objects')->where('id',$id)->update(['cached_at'=>now()->subHours(2),'accessed_at'=>now()->subHours(2)]);
    DB::table('zt_archive_assets')->insert(['owner'=>$owner,'hash'=>$hash,'slot'=>'attachments.0.preview','state'=>'ready']);
    check($store->evict()===0,'Previews remain on SSD');
    DB::table('zt_archive_assets')->delete();
    $fake->meta['file-1']['sha256Checksum']=str_repeat('0',64);
    check($store->evict()===0 && is_file($path),'Recheck remote integrity before freeing cache');
    $fake->meta['file-1']['sha256Checksum']=$hash;
    check($store->evict()===10000000 && !is_file($path),'Only verified exact cold blob removed locally');
    check(isset($fake->data['file-1']),'Remote original never deleted');
    // Final upload acknowledgement can be lost as well: adopt matching remote content.
    [$path2,$hash2,$id2]=blob('small',$owner); $fake->lostAck=true;
    check(!$store->transfer($id2) && $store->transfer($id2),'Lost final reply recovers from metadata');
    check($fake->starts===2,'No extra create after lost final acknowledgement');
    [$badPath,$badHash,$badId]=blob('wrong hash case',$owner); $fake->wrongHash=true;
    check(!$store->transfer($badId) && is_file($badPath),'Mismatched remote hash preserves source'); $fake->wrongHash=false;
    [$blockedPath,$blockedHash,$blockedId]=blob('overprivileged',$owner); $fake->deleteAllowed=true;
    check(!$store->transfer($blockedId),'Deletion-capable service account rejected'); $fake->deleteAllowed=false;
    // Backup files remain encrypted through remote roundtrip; locator recovery needs no old DB.
    $zipPath=$root.'/encrypted.zip'; $zip=new ZipArchive; $zip->open($zipPath,ZipArchive::CREATE);
    $zip->setPassword('backup-test-password'); $zip->addFromString('content','private fixture'); $zip->setEncryptionName('content',ZipArchive::EM_AES_256);$zip->close();
    [$backupPath,$backupHash,$backupId]=blob(file_get_contents($zipPath),$owner,'backup-blob',hash('sha256','private fixture'));
    check($store->transfer($backupId),'Encrypted backup uploaded'); unlink($backupPath);
    DB::table('zt_archive_drive_objects')->where('id',$backupId)->delete();
    check($store->recoverCatalog($owner)===1,'Rebuild lost locator from authenticated Drive metadata');
    $store->read($owner,'backup-blob',hash('sha256','private fixture'));
    $zip=new ZipArchive; $zip->open($backupPath);check($zip->getFromName('content')===false,'Backup unreadable without key');
    $zip->setPassword('backup-test-password'); check($zip->getFromName('content')==='private fixture','Cold backup roundtrip decrypts');$zip->close();
    try{$store->path('../escape','archive',$hash);throw new Exception('Traversal accepted');}catch(InvalidArgumentException){$checks++;}
    // Real HTTP transport response parsing and SSRF guard, no live network.
    Http::preventStrayRequests();
    $http=new class extends ZaloTeamDriveClient {protected function http():Illuminate\Http\Client\PendingRequest {return Http::withOptions(['allow_redirects'=>false]);}};
    Http::fake(['www.googleapis.com/*'=>Http::sequence()->push('',308,['Range'=>'bytes=0-262143'])->push('',404)->push('',200)]);
    $uri='https://www.googleapis.com/upload/drive/v3/files?upload_id=test';
    check($http->probe($uri,1048576)['offset']===262144,'Probe consumes acknowledged Range only');
    check($http->probe($uri,1048576)['expired'],'Expired session restarts using same file ID');
    check($http->probe($uri,1048576)['offset']===1048576,'Completed probe recognizes total');
    expectError(fn()=>$http->probe('https://attacker.invalid/steal',12),'drive_invalid_session');
    expectError(fn()=>$http->probe('https://www.googleapis.com:444/upload/drive/v3/files',12),'drive_invalid_session');
    echo "PASS $checks Drive storage checks\n";
} finally {
    // Test-created directory only, resolved and bounded before recursion.
    $resolved=realpath($root);$temp=realpath(sys_get_temp_dir());
    if($resolved && str_starts_with($resolved,$temp.DIRECTORY_SEPARATOR) && str_starts_with(basename($resolved),'zt-drive-test-')) {
        $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($resolved,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
        foreach($it as $f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($resolved);
    }
}
