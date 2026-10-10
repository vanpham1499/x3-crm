<?php
// D1 CRM collaboration regression. All writes are to disposable in-memory SQLite.
putenv('ZALO_TEAM_RUNTIME=combined');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\{DB, Schema, Http};
use Illuminate\Database\Schema\Blueprint;
use App\Models\User;
use App\Services\{ZaloTeamCatalog, ZaloTeamWorkspace, ZaloTeamAccess, ZaloTeamRuntime};
set_exception_handler(function(Throwable $e) { fwrite(STDERR,$e."\n"); exit(1); });
config(['database.default'=>'workspace_test','database.connections.workspace_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'','foreign_key_constraints'=>true],
    'cache.default'=>'array','zalo_team.storage_owner'=>str_repeat('a',64)]);
DB::purge('workspace_test');
if(DB::connection()->getDatabaseName()!==':memory:') throw new Exception('Unsafe DB');
Http::preventStrayRequests();
Schema::create('users',function(Blueprint $t){$t->id();$t->string('name');$t->string('role');$t->boolean('is_active')->default(true);$t->unsignedBigInteger('department_id')->nullable();$t->softDeletes();$t->timestamps();});
Schema::create('departments',function(Blueprint $t){$t->id();$t->string('name');$t->unsignedBigInteger('leader_user_id')->nullable();$t->softDeletes();$t->timestamps();});
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_08_000100_create_zalo_access.php')->up();
// The existing tag workspace has a different schema and must coexist unchanged.
Schema::create('zt_workspaces',function(Blueprint $t){$t->string('id')->primary();$t->integer('revision');});
DB::table('zt_workspaces')->insert(['id'=>'existing-tags','revision'=>7]);
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_09_000230_create_zalo_crm_workspaces.php')->up();
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_09_000240_create_zalo_crm_collaboration.php')->up();
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_09_000250_optimize_zalo_crm_reminders.php')->up();
(require __DIR__.'/../../apps/backend/database/migrations/2026_08_01_000400_create_user_notifications_table.php')->up();
Illuminate\Support\Facades\Event::fake([App\Events\UserNotificationsChanged::class]);
foreach(['customers','leads','projects'] as $table) Schema::create($table,function(Blueprint $t) use($table){
    $t->id();$t->string($table==='projects'?'project_name':'customer_name');$t->string($table==='projects'?'project_code':($table==='customers'?'customer_code':'lead_code'));
    $t->unsignedBigInteger($table==='leads'?'assigned_user_id':'sales_user_id')->nullable();
    if($table==='projects') {foreach(['customer_id','manager_user_id','service_id','status_option_id'] as $f)$t->unsignedBigInteger($f)->nullable();$t->date('start_date')->nullable();$t->date('end_date')->nullable();}
    $t->softDeletes();$t->timestamps();
});
foreach(['services','options'] as $table) Schema::create($table,function(Blueprint $t) use($table){$t->id();$t->string($table==='services'?'name':'label');$t->softDeletes();});
foreach([[1,'Admin','ADMIN',null],[2,'Leader A','LEADER',10],[3,'Staff A','EMPLOYEE',10],[4,'Staff A2','EMPLOYEE',10],[5,'Staff B','EMPLOYEE',20],[6,'Viewer','EMPLOYEE',10],[7,'Outsider','EMPLOYEE',20]] as [$id,$name,$role,$dept]) DB::table('users')->insert(['id'=>$id,'name'=>$name,'role'=>$role,'department_id'=>$dept]);
DB::table('departments')->insert([['id'=>10,'name'=>'A','leader_user_id'=>2],['id'=>20,'name'=>'B','leader_user_id'=>7]]);
foreach([[101,'901',10],[102,'902',20],[103,'903',10]] as [$id,$external,$dept]) DB::table('zt_access_accounts')->insert(['account_id'=>$id,'external_id'=>$external,'name'=>'Fixture','department_id'=>$dept,'revision'=>0]);
foreach([[101,3,10,'operate'],[101,4,10,'operate'],[101,5,20,'operate'],[101,6,10,'read'],[102,5,20,'operate'],[103,3,10,'operate']] as [$a,$u,$d,$level]) DB::table('zt_access_grants')->insert(['account_id'=>$a,'user_id'=>$u,'department_at_grant'=>$d,'level'=>$level,'can_sync'=>false,'can_link'=>false]);
DB::table('customers')->insert([['id'=>10,'customer_code'=>'KH10','customer_name'=>'Customer A','sales_user_id'=>3],['id'=>20,'customer_code'=>'KH20','customer_name'=>'Customer B','sales_user_id'=>5]]);
DB::table('leads')->insert(['id'=>30,'lead_code'=>'L30','customer_name'=>'Lead A','assigned_user_id'=>3]);
DB::table('services')->insert(['id'=>1,'name'=>'Ads']);DB::table('options')->insert(['id'=>1,'label'=>'Đang triển khai']);
foreach([[100,10,3],[200,20,5],[101,10,3]] as [$id,$customer,$sale])DB::table('projects')->insert(['id'=>$id,'project_code'=>'P'.$id,'project_name'=>'Project '.$id,'customer_id'=>$customer,'sales_user_id'=>$sale,'manager_user_id'=>$sale,'service_id'=>1,'status_option_id'=>1,'end_date'=>'2026-12-31']);
class WorkspaceUser extends User {
    protected $table='users';
    public array $permissions=[];
    public function hasPermission(string $code):bool{return in_array($code,$this->permissions,true);}
}
function actor(int $id,array $permissions=[]):WorkspaceUser {
    $u=WorkspaceUser::findOrFail($id);$u->permissions=$permissions ?: ($id===1?['customer.view_all','lead.view_all','project.view_all']:['customer.view','lead.view','project.view']); return $u;
}
class WorkspaceCatalog extends ZaloTeamCatalog {
    public array $rows=[
        ['accountId'=>101,'conversationId'=>'g11','globalGroupId'=>'native_Global-9001','name'=>'Same name'],
        ['accountId'=>102,'conversationId'=>'g22','globalGroupId'=>'native_Global-9001','name'=>'Same name'],
        ['accountId'=>101,'conversationId'=>'g33','globalGroupId'=>'9002','name'=>'Same name'],
        ['accountId'=>101,'conversationId'=>'g44','name'=>'Missing identity'],
        ['accountId'=>101,'conversationId'=>'55','name'=>'Customer'],
        ['accountId'=>103,'conversationId'=>'55','name'=>'Customer'],
    ];
    public string $external='901';
    public function command(User $user,array $body):array {
        $ids=ZaloTeamAccess::ids($user);
        if($body['action']==='messages') return ['messages'=>[['id'=>'verified-message','time'=>1791536400000]]];
        if($body['action']==='status') return ['accounts'=>[['id'=>101,'externalId'=>$this->external],['id'=>102,'externalId'=>'902'],['id'=>103,'externalId'=>'903']]];
        return ['accounts'=>[['id'=>101,'state'=>'connected'],['id'=>102,'state'=>'connected'],['id'=>103,'state'=>'connected']],
            'conversations'=>array_values(array_filter($this->rows,fn($c)=>($ids===null||in_array($c['accountId'],$ids,true))&&(!isset($body['accountId'])||$c['accountId']===$body['accountId'])))];
    }
}
$catalog=new WorkspaceCatalog;$service=new ZaloTeamWorkspace($catalog);$checks=0;
function check(bool $ok,string $label):void {global $checks;if(!$ok)throw new Exception($label);$checks++;echo "PASS $label\n";}
function denied(callable $fn,int $status):void {try{$fn();}catch(Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e){check($e->getStatusCode()===$status,"denied $status");return;}throw new Exception("Expected $status");}
function read(int $who=3,int $account=101,string $peer='g11'):array{global $service;return $service->read(actor($who),$account,$peer);}
function change(int $who,string $kind,array $extra=[],int $account=101,string $peer='g11'):array{global $service;return $service->mutate(actor($who),['kind'=>$kind,'accountId'=>$account,'conversationId'=>$peer,'revision'=>read($who,$account,$peer)['revision']]+$extra);}
check(!collect(ZaloTeamRuntime::migrationPaths())->contains(fn($p)=>str_contains($p,'create_zalo_crm_workspaces')),'CRM migration excluded from Zalo service');
check(DB::table('zt_workspaces')->value('revision')===7,'D1 migration preserves legacy tag workspace');
$controller=new App\Http\Controllers\ZaloTeamWorkspaceController;
$request=Illuminate\Http\Request::create('/api/zalo-team/workspace','POST',['kind'=>'lookup','accountId'=>101,'entityKind'=>'customer','search'=>null,'page'=>0]);
$request->setUserResolver(fn()=>actor(3));
check($controller->command($request,$service)->getStatusCode()===200,'empty search normalized by HTTP middleware is accepted');
$request=Illuminate\Http\Request::create('/api/zalo-team/workspace','POST',['kind'=>'assign','accountId'=>101,'conversationId'=>'g11','revision'=>0]);
$request->setUserResolver(fn()=>actor(1));
try {$controller->command($request,$service);throw new Exception('Missing assignee should not unassign');}
catch(Illuminate\Validation\ValidationException $e){check(isset($e->errors()['assigneeId']),'assignment requires explicit assignee including null');}
$emptyCount=DB::table('zt_crm_workspaces')->count();
denied(fn()=>change(3,'state',['state'=>'resolved'],101,'g33'),403);
check(DB::table('zt_crm_workspaces')->count()===$emptyCount&&DB::table('zt_crm_workspace_sources')->count()===0,'denied first mutation rolls back workspace and alias');
$first=read();check($first['canClaim']&&!$first['canEdit']&&$first['revision']===0,'new work requires claim');
check(DB::table('zt_crm_workspaces')->count()===0,'read has no writes');
$mine=change(3,'claim');check($mine['assignee']['id']===3&&$mine['canEdit']&&$mine['revision']===1,'operator claims own conversation');
denied(fn()=>change(4,'claim'),409);
denied(fn()=>$service->mutate(actor(3),['kind'=>'state','accountId'=>101,'conversationId'=>'g11','revision'=>0,'state'=>'resolved']),409);
denied(fn()=>change(4,'state',['state'=>'resolved']),403);
denied(fn()=>change(6,'claim'),403);
denied(fn()=>read(7,101),403);
$other=read(5,102,'g22');check($other['assignee']['id']===3&&$other['revision']===1,'verified same group shares work before opening alias');
$s=$service->summaries(actor(5));check(collect($s['items'])->firstWhere('conversationId','g22')['assigneeId']===3,'filter sees canonical work through second account');
check(!collect($service->summaries(actor(3))['items'])->contains('accountId',102),'summaries exclude unauthorized accounts');
check(read(3,101,'g33')['assignee']===null,'same name with different global ID stays separate');
$catalog->rows[]=['accountId'=>101,'conversationId'=>'g66','globalGroupId'=>'9002','name'=>'Ambiguous'];
denied(fn()=>change(3,'claim',[],101,'g33'),409);
check(!collect($service->summaries(actor(3))['items'])->contains('conversationId','g33'),'ambiguous groups do not appear as unassigned work');
array_pop($catalog->rows);
denied(fn()=>change(3,'claim',[],101,'g44'),409);
denied(fn()=>change(3,'claim',[],101,'99999'),409);
$state=change(3,'state',['state'=>'waiting_customer']);check($state['state']==='waiting_customer','state independent from native unread');
denied(fn()=>change(3,'assign',['assigneeId'=>4]),403);
denied(fn()=>change(2,'assign',['assigneeId'=>5]),403);
denied(fn()=>change(2,'assign',['assigneeId'=>6]),422);
check(change(2,'assign',['assigneeId'=>4])['assignee']['id']===4,'leader hands off within team');
check(change(1,'assign',['assigneeId'=>5])['assignee']['id']===5,'admin may hand off eligible cross-team operator');
change(1,'assign',['assigneeId'=>3]);
$linked=change(3,'link',['entityKind'=>'customer','entityId'=>10]);check(count($linked['links'])===1,'link visible customer');
denied(fn()=>change(3,'link',['entityKind'=>'customer','entityId'=>20]),404);
$linked=change(3,'link',['entityKind'=>'project','entityId'=>100]);check(count($linked['links'])===2&&$linked['links'][1]['status']==='Đang triển khai','link project with status and service');
change(3,'link',['entityKind'=>'project','entityId'=>101]);
check(count(read()['links'])===3,'multiple projects supported');
denied(fn()=>change(1,'link',['entityKind'=>'project','entityId'=>200]),422);
denied(fn()=>change(3,'link',['entityKind'=>'lead','entityId'=>30]),422);
$hidden=read(4);check($hidden['restrictedLinks']&&$hidden['links']===[],'Zalo access does not grant CRM profile access');
check(!str_contains(json_encode($hidden['events']),'entity_id')&&!str_contains(json_encode($hidden['events']),'KH10'),'audit does not disclose hidden CRM profile');
check(count($service->lookup(actor(3),101,'customer','',0)['items'])===1,'lookup filters own customer before page');
check(count($service->lookup(actor(2,['customer.view_department']),101,'customer','',0)['items'])===1,'lookup department uses CRM permission');
check(count($service->lookup(actor(2,['unrelated']),101,'customer','',0)['items'])===0,'Zalo leader does not imply CRM permission');
check(count($service->lookup(actor(1),101,'customer','%',0)['items'])===0,'lookup treats SQL wildcard literally');
check(collect($service->lookup(actor(1),101,'project','',0,10)['items'])->pluck('id')->sort()->values()->all()===[100,101],'linked customer narrows project picker');
check(count($service->lookup(actor(3),101,'project','',0,20)['items'])===0,'customer filter never widens project permission');
$projectRequest=Illuminate\Http\Request::create('/api/zalo-team/workspace','POST',['kind'=>'lookup','accountId'=>101,'entityKind'=>'project','customerId'=>20,'search'=>null]);
$projectRequest->setUserResolver(fn()=>actor(1));
check(array_column($controller->command($projectRequest,$service)->getData(true)['items'],'id')===[200],'HTTP customer filter reaches scoped project lookup');
for($i=1000;$i<1025;$i++) DB::table('customers')->insert(['id'=>$i,'customer_code'=>'B'.$i,'customer_name'=>'Batch','sales_user_id'=>3]);
$p0=$service->lookup(actor(3),101,'customer','Batch',0);$p1=$service->lookup(actor(3),101,'customer','Batch',1);
check(count($p0['items'])===20&&$p0['hasMore']&&count($p1['items'])===5&&!$p1['hasMore'],'lookup pagination after scope');
change(3,'unlink',['entityKind'=>'project','entityId'=>100]);check(App\Models\Project::find(100)!==null&&count(read()['links'])===2,'unlink preserves CRM record');
change(3,'unlink',['entityKind'=>'project','entityId'=>101]);change(3,'unlink',['entityKind'=>'customer','entityId'=>10]);
change(3,'link',['entityKind'=>'lead','entityId'=>30]);check(read()['links'][0]['kind']==='lead','lead profile supported');
check(read()['events'][0]['actor']==='Staff A','audit names actor');
check((bool)preg_match('/(?:Z|[+-]\d\d:\d\d)$/',read()['events'][0]['at']),'audit time has explicit timezone');
$before=DB::table('zt_crm_workspace_events')->count();
denied(fn()=>change(4,'state',['state'=>'resolved']),403);check(DB::table('zt_crm_workspace_events')->count()===$before,'denied mutations do not append successful audit');
DB::table('zt_access_grants')->where('user_id',3)->where('account_id',101)->delete();
check(read(4)['assignee']===null&&read(4)['assignmentUnavailable'],'revoked assignee becomes available for claim');
check(change(4,'claim')['assignee']['id']===4,'another operator can reclaim after revocation');
DB::table('users')->where('id',4)->update(['is_active'=>false]);check(read(1)['assignee']===null,'inactive assignee cannot retain active assignment');
change(3,'claim',[],103,'55');check(read(1,101,'55')['assignee']===null,'personal peers never merge across accounts');
$catalog->external='999';denied(fn()=>change(1,'state',['state'=>'resolved']),409);$catalog->external='901';
config(['zalo_team.storage_owner'=>str_repeat('b',64)]);check(read(1)['assignee']===null,'storage owner namespaces work');
echo "PASS $checks D1 checks; no external requests or business writes\n";
