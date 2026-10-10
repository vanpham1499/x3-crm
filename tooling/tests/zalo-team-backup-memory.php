<?php
// Synthetic disk database and temp archive only; demonstrates batching without touching local CRM.
putenv('ZALO_TEAM_RUNTIME=zalo');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $e) { fwrite(STDERR, 'FAIL: '.$e."\n"); exit(1); });
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use App\Services\ZaloTeamArchive;
use App\Services\ZaloTeamArchiveBackup;

$root = sys_get_temp_dir().'/zt-memory-'.bin2hex(random_bytes(8));
mkdir($root, 0700);
touch($root.'/test.sqlite');
config(['database.default' => 'memory_test', 'database.connections.memory_test' => ['driver' => 'sqlite', 'database' => $root.'/test.sqlite', 'prefix' => '', 'foreign_key_constraints' => true],
    'cache.default' => 'array', 'zalo_team.drive.enabled' => false, 'zalo_team.storage_owner' => str_repeat('a', 64),
    'zalo_team.archive_path' => $root.'/archive', 'zalo_team.backup_path' => $root.'/backup', 'zalo_team.backup_password' => str_repeat('fixture-key', 8)]);
Illuminate\Support\Facades\Http::preventStrayRequests();
try {
    if (Artisan::call('zalo-team:migrate') !== 0) { throw new RuntimeException('migration failed'); }
    $u = new App\Models\ZaloTeamIdentityUser;
    $u->forceFill(['id' => 1, 'is_active' => true, 'zalo_access' => ['admin' => true, 'owner' => str_repeat('a', 64)]]);
    $owner = ZaloTeamArchive::owner($u);
    DB::table('users')->insert(['id' => 1, 'zalo_owner' => $owner]);
    $count = 6000;
    $content = json_encode(['text' => str_repeat('synthetic-message-', 1024)]);
    DB::transaction(function () use ($count, $content, $owner) {
        for ($i = 0; $i < $count; $i++) {
            DB::table('zt_archive_messages')->insert(['id' => hash('sha256', 'fixture-'.$i), 'owner' => $owner, 'canonical' => 'group:fixture', 'native_id' => (string) $i, 'time' => 1780000000000 + $i, 'content' => $content]);
        }
    });
    $backup = app(ZaloTeamArchiveBackup::class);
    $id = $backup->request($u);
    gc_collect_cycles(); memory_reset_peak_usage();
    $before = memory_get_usage(true);
    $backup->create($u, $id);
    $result = $backup->verify($u, $id);
    $extra = memory_get_peak_usage(true) - $before;
    if ($result['rows'] < $count || $extra > 32 * 1024 * 1024) { throw new RuntimeException('backup exceeded 32 MiB growth or lost rows'); }
    DB::table('zt_archive_messages')->where('native_id', '5999')->delete();
    $backup->restore($u, $id);
    if (DB::table('zt_archive_messages')->count() !== $count) { throw new RuntimeException('restore count differs'); }
    echo 'PASS: 6000 synthetic messages, '.round($count * strlen($content) / 1048576, 1).' MiB content; backup PHP heap growth '.round($extra / 1048576, 1)." MiB; restore count matches.\n";
} finally {
    DB::disconnect('memory_test');
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $entry) { $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname()); }
    rmdir($root);
}
