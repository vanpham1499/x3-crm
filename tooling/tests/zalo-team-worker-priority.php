<?php
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app=require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function(Throwable $e){fwrite(STDERR,'FAIL: '.$e->getMessage()."\n");exit(1);});
use Illuminate\Support\Facades\{DB,Schema,Artisan};
use Illuminate\Database\Schema\Blueprint;
use App\Services\{ZaloTeamArchiveSync,ZaloTeamArchiveBackup};
config(['zalo_team.runtime'=>'combined','zalo_team.remote_api_url'=>null,'zalo_team.maintenance'=>false,
    'database.default'=>'priority_test','database.connections.priority_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'']]);
DB::purge('priority_test');if(DB::connection()->getDatabaseName()!==':memory:')throw new Exception('Unsafe DB');
Schema::create('users',function(Blueprint $t){$t->id();$t->boolean('is_active');$t->softDeletes();});
Schema::create('zt_archive_settings',function(Blueprint $t){$t->string('owner')->primary();$t->integer('user_id');$t->boolean('daily_backup');});
Schema::create('zt_archive_backups',function(Blueprint $t){$t->string('id')->primary();$t->string('owner');$t->string('state');$t->timestamp('created_at');});
DB::table('users')->insert(['id'=>1,'is_active'=>true]);
DB::table('zt_archive_settings')->insert(['owner'=>'test','user_id'=>1,'daily_backup'=>false]);
DB::table('zt_archive_backups')->insert(['id'=>'snapshot','owner'=>'test','state'=>'pending','created_at'=>now()]);
$sync=new class extends ZaloTeamArchiveSync{public int $runs=0;public function __construct(){}public function run(App\Models\User $u,int $budget=45):array{$this->runs++;return ['pages'=>0];}};
$backup=new class extends ZaloTeamArchiveBackup{public int $runs=0;public function __construct(){}public function create(App\Models\User $u,string $id):void{$this->runs++;DB::table('zt_archive_backups')->where('id',$id)->update(['state'=>'ready']);}};
$app->instance(ZaloTeamArchiveSync::class,$sync);$app->instance(ZaloTeamArchiveBackup::class,$backup);
Artisan::call('zalo-team:archive',['--mode'=>'sync']);if($sync->runs!==0)throw new Exception('Sync overtook pending backup');
Artisan::call('zalo-team:archive',['--mode'=>'backup']);if($backup->runs!==1)throw new Exception('Backup not processed: '.Artisan::output());
Artisan::call('zalo-team:archive',['--mode'=>'sync']);if($sync->runs!==1)throw new Exception('Sync did not resume');
config(['zalo_team.remote_api_url'=>'http://unused.test/api']);
Artisan::call('zalo-team:archive',['--mode'=>'backup']);if($backup->runs!==1)throw new Exception('Local worker still wrote after cutover');
echo "PASS 4 worker scheduling checks\n";
