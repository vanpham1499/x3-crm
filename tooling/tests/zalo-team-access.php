<?php
// Isolated fixtures only: no connector traffic, production DB or real assignments.
putenv('ZALO_TEAM_RUNTIME=combined');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use App\Models\User;
use App\Services\ZaloTeamAccess;
use App\Services\ZaloTeamArchive;
use App\Services\ZaloTeamCatalog;
use App\Http\Controllers\ZaloTeamAccessController;

set_exception_handler(function(Throwable $e){fwrite(STDERR, $e."\n");exit(1);});
config(['database.default'=>'acl_test','database.connections.acl_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'','foreign_key_constraints'=>true], 'cache.default'=>'array','zalo_team.storage_owner'=>str_repeat('a',64)]);
DB::purge('acl_test');
if(DB::connection()->getDatabaseName()!==':memory:')throw new Exception('Unsafe test DB');
Illuminate\Support\Facades\Http::preventStrayRequests();
Schema::create('users',function(Blueprint $t){$t->id();$t->string('name');$t->string('role');$t->boolean('is_active')->default(true);$t->unsignedBigInteger('department_id')->nullable();$t->softDeletes();$t->timestamps();});
Schema::create('departments',function(Blueprint $t){$t->id();$t->string('name');$t->unsignedBigInteger('leader_user_id')->nullable();$t->softDeletes();$t->timestamps();});
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_08_000100_create_zalo_access.php')->up();
foreach([[1,'Admin','ADMIN',null],[2,'Leader A','LEADER',10],[3,'Leader B','LEADER',20],[4,'Staff A','EMPLOYEE',10],[5,'Staff B','EMPLOYEE',20],[6,'Unassigned staff','LEADER',10]] as [$id,$name,$role,$dept]) DB::table('users')->insert(['id'=>$id,'name'=>$name,'role'=>$role,'department_id'=>$dept]);
DB::table('departments')->insert([['id'=>10,'name'=>'A','leader_user_id'=>2],['id'=>20,'name'=>'B','leader_user_id'=>3],['id'=>30,'name'=>'C','leader_user_id'=>2]]);
class FakeAccessCatalog extends ZaloTeamCatalog {public function rawCommand(User $u,array $body):array{return ['accounts'=>[['id'=>101,'externalId'=>'9101','name'=>'Zalo A'],['id'=>102,'externalId'=>'9102','name'=>'Zalo B']]];}}
$catalog=new FakeAccessCatalog;$service=new ZaloTeamAccess;$controller=new ZaloTeamAccessController;$checks=0;
function check($ok,$why){global $checks;if(!$ok)throw new Exception($why);$checks++;}
function denied($fn,$status=403){try{$fn();}catch(Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e){check($e->getStatusCode()===$status,'Expected '.$status.', got '.$e->getStatusCode());return;}throw new Exception('Expected denial');}
function actor($id){return User::findOrFail($id);}
function command($id,$body){global $controller,$service,$catalog;$r=Illuminate\Http\Request::create('/api/zalo-team/access','POST',$body);$r->setUserResolver(fn()=>actor($id));return $controller->command($r,$service,$catalog)->getData(true);}
function grant($id,$level='operate'){return ['userId'=>$id,'level'=>$level,'canSync'=>false,'canLink'=>false];}
command(1,['kind'=>'read']);
check(DB::table('zt_access_accounts')->whereNull('department_id')->count()===2,'existing accounts remain unassigned');
check(ZaloTeamAccess::ids(actor(1))===null,'admin all');
foreach([2,3,4,5,6] as $id)check(ZaloTeamAccess::ids(actor($id))===[],'unassigned admin only');
command(1,['kind'=>'save','accountId'=>101,'revision'=>0,'departmentId'=>10,'primaryUserId'=>4,'grants'=>[grant(4),grant(5,'read')]]);
check(ZaloTeamAccess::ids(actor(2),'manage')===[101],'actual department leader manages');
check(ZaloTeamAccess::ids(actor(6))===[],'role or membership alone cannot grant access');
check(ZaloTeamAccess::ids(actor(3))===[],'shared employee leader gets no inherited access');
check(ZaloTeamAccess::ids(actor(5))===[101] && ZaloTeamAccess::ids(actor(5),'write')===[],'cross-team read only');
check(ZaloTeamAccess::ids(actor(4),'write')===[101],'explicit operator');
denied(fn()=>ZaloTeamAccess::allow(actor(5),101,'write'));
denied(fn()=>ZaloTeamAccess::allow(actor(4),102));
denied(fn()=>command(2,['kind'=>'save','accountId'=>101,'revision'=>1,'departmentId'=>20,'grants'=>[]]));
denied(fn()=>command(2,['kind'=>'save','accountId'=>101,'revision'=>1,'departmentId'=>10,'grants'=>[grant(5)]]));
denied(fn()=>command(1,['kind'=>'save','accountId'=>101,'revision'=>0,'departmentId'=>10,'grants'=>[]]),409);
command(2,['kind'=>'save','accountId'=>101,'revision'=>1,'departmentId'=>10,'primaryUserId'=>4,'grants'=>[grant(4)]]);
check(DB::table('zt_access_grants')->where('user_id',5)->exists(),'leader cannot remove admin cross-team grant');
denied(fn()=>command(2,['kind'=>'save','accountId'=>101,'revision'=>2,'departmentId'=>10,'grants'=>[['userId'=>4,'level'=>'read','canSync'=>true,'canLink'=>false]]]),422);
check(DB::table('zt_access_grants')->where('user_id',4)->value('level')==='operate','invalid mutation rolls back');
$u=actor(4);$u->department_id=20;$u->save();
check(ZaloTeamAccess::ids($u)===[],'department move revokes access');
check(DB::table('zt_access_accounts')->where('account_id',101)->value('primary_user_id')===null,'move clears primary assignee');
check((int)DB::table('zt_access_accounts')->where('account_id',101)->value('department_id')===10,'account retained by previous department');
$u=actor(5);$u->is_active=false;$u->save();
check(!DB::table('zt_access_grants')->where('user_id',5)->exists(),'deactivation removes grants');
denied(fn()=>ZaloTeamAccess::scope($u),401);
$u->is_active=true;$u->save();check(ZaloTeamAccess::ids($u)===[],'reactivation cannot resurrect grant');
command(1,['kind'=>'save','accountId'=>102,'revision'=>0,'departmentId'=>30,'grants'=>[]]);
check(ZaloTeamAccess::ids(actor(2),'manage')===[101,102],'multiple departments led');
DB::table('departments')->where('id',10)->update(['leader_user_id'=>3]);
check(ZaloTeamAccess::ids(actor(2))===[102]&&ZaloTeamAccess::ids(actor(3))===[101],'leader replacement effective on next request');
Schema::create('zt_archive_sources',function(Blueprint $t){$t->string('id')->primary();$t->string('owner');$t->integer('account_id');});
Schema::create('zt_archive_observations',function(Blueprint $t){$t->string('source_id');$t->string('message_id');$t->boolean('deleted')->default(false);});
DB::table('zt_archive_sources')->insert([['id'=>'sA','owner'=>str_repeat('a',64),'account_id'=>101],['id'=>'sB','owner'=>str_repeat('a',64),'account_id'=>102]]);
DB::table('zt_archive_observations')->insert([['source_id'=>'sA','message_id'=>'shared'],['source_id'=>'sB','message_id'=>'shared'],['source_id'=>'sB','message_id'=>'privateB']]);
check(ZaloTeamAccess::messages(actor(3))->pluck('message_id')->all()===['shared'],'shared physical data does not leak other source');
denied(fn()=>(new ZaloTeamArchive)->source(actor(3),'sB'));
check((new ZaloTeamArchive)->source(actor(2),'sB')->account_id===102,'archive checks source account');
DB::table('departments')->where('id',30)->update(['deleted_at'=>now()]);
check(ZaloTeamAccess::ids(actor(2))===[],'deleted team not accessible');
check(DB::table('zt_access_audit')->where('action','access.save')->count()===3,'successful assignment changes audited, failures rolled back');
check((int)DB::table('zt_access_accounts')->where('account_id',101)->value('revision')===4,'revocation invalidates open dialogs including non-primary grants');
config(['zalo_team.remote_api_url'=>null, 'zalo_team.maintenance'=>false]);
$archiveController=new App\Http\Controllers\ZaloTeamArchiveController;
foreach (['backup','cleanup-preview','server-status','file-status','sync','retry-files'] as $kind) {
    $r=Illuminate\Http\Request::create('http://localhost/api/zalo-team/archive','POST',['kind'=>$kind,'mode'=>'cleanup']);
    $r->setUserResolver(fn()=>actor(4));
    denied(fn()=>$archiveController->command($r,new ZaloTeamArchive,$catalog,app(App\Services\ZaloTeamArchiveBackup::class)));
}
Schema::create('zt_archive_assets',function(Blueprint $t){$t->string('id')->primary();$t->string('owner');$t->string('state');$t->string('message_id');});
DB::table('zt_archive_assets')->insert(['id'=>str_repeat('b',64),'owner'=>str_repeat('a',64),'state'=>'ready','message_id'=>'privateB']);
$r=Illuminate\Http\Request::create('http://localhost/api/zalo-team/archive/assets/'.str_repeat('b',64));
$r->setUserResolver(fn()=>actor(3));
denied(fn()=>$archiveController->asset($r,str_repeat('b',64),new App\Services\ZaloTeamArchiveFiles),404);
$u=actor(4);$u->delete();
check(ZaloTeamAccess::ids(actor(1))===null && DB::table('zt_access_accounts')->count()===2,'deleting employee preserves accounts and data');
echo "PASS: $checks permission and archive isolation checks\n";
