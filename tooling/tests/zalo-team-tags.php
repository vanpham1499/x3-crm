<?php
// In-memory database, fake native catalog. Never change real Zalo or CRM records.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app=require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Str;
use App\Services\ZaloTeamTags;
config(['database.default'=>'tag_test','database.connections.tag_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'','foreign_key_constraints'=>true],'zalo_team.workspace'=>'test','cache.default'=>'array']);
DB::purge('tag_test');
if(DB::connection()->getDatabaseName()!==':memory:')throw new Exception('Unsafe test database');
foreach(['users','roles'] as $t) Schema::create($t,function(Blueprint $t){$t->id();$t->string('name')->nullable();});
Schema::create('permissions',function(Blueprint $t){$t->id();$t->string('code');$t->string('module');$t->string('name');$t->string('description');$t->timestamps();});
Schema::create('role_permissions',function(Blueprint $t){$t->integer('role_id');$t->integer('permission_id');$t->timestamps();});
DB::table('users')->insert([['id'=>1],['id'=>2]]);
$migration=require __DIR__.'/../../apps/backend/database/migrations/2026_10_03_000100_create_zalo_team_tags.php';$migration->up();
class TagUser extends App\Models\User { public bool $manage=true; public function hasPermission(string $code):bool{return $this->manage;} }
$u=new TagUser();$u->id=1;$u->exists=true;$employee=new TagUser();$employee->id=2;$employee->manage=false;
$s=new ZaloTeamTags();
$cat=['sources'=>['1:11'=>['key'=>'100:11','name'=>'A','accountName'=>'Duy'],'1:g7'=>['key'=>'100:g7','name'=>'Group','accountName'=>'Duy'],'3:g8'=>['key'=>'200:g8','name'=>'Group','accountName'=>'Anh']], 'groups'=>[['id'=>'linked','sources'=>['1:g7','3:g8']]],'labels'=>[['key'=>'100:label:1','accountName'=>'Duy','name'=>'Old','color'=>'#0068ff','members'=>['100:11','100:g7'],'pending'=>1]],'accounts'=>[['id'=>1,'name'=>'Duy']],'unavailable'=>[],'blockedSources'=>[]];
$checks=0;
function check($ok,$why){global $checks;if(!$ok)throw new Exception($why);$checks++;}
function reject($fn,$code){try{$fn();}catch(Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e){check($e->getStatusCode()===$code,'Wrong status: '.$e->getStatusCode());return;}throw new Exception('Expected rejection '.$code);}
function act($v,$user=null,$scope=null){global $s,$u,$cat; $user??=$u;$scope??=$cat;return $s->mutate($user,$v+['revision'=>$s->read($user,$scope)['revision'],'requestId'=>(string)Str::uuid()],$scope);}
function tagId($name){return DB::table('zt_tags')->where('workspace',config('zalo_team.workspace'))->where('name',$name)->value('id');}
act(['kind'=>'create','name'=>'VIP','color'=>'#ff0000']);$vip=tagId('VIP');
check(count($s->read($employee,$cat)['tags'])===1,'catalog shared across users');
reject(fn()=>act(['kind'=>'create','name'=>'Other','color'=>'#000000'],$employee),403);
reject(fn()=>act(['kind'=>'create','name'=>' vip ','color'=>'#000000']),409);
act(['kind'=>'assign','source'=>'1:g7','id'=>$vip,'active'=>true],$employee);
$r=$s->read($u,$cat);check($r['assignments']->{'3:g8'}===[$vip],'linked group projects same tags');check($r['tags'][0]['count']===1,'group counted once');
reject(fn()=>act(['kind'=>'assign','source'=>'1:99','id'=>$vip,'active'=>true]),403);
$blocked=$cat;$blocked['blockedSources']=['1:g7'];reject(fn()=>act(['kind'=>'assign','source'=>'1:g7','id'=>$vip,'active'=>false],null,$blocked),409);
$empty=$cat;$empty['sources']=[];$empty['groups']=[];
check((array)$s->read($employee,$empty)['assignments']===[],'no assignments leaked to unavailable scope');
$dup=['kind'=>'assign','source'=>'1:11','id'=>$vip,'active'=>true,'revision'=>$s->read($u,$cat)['revision'],'requestId'=>(string)Str::uuid()];
$s->mutate($u,$dup,$cat);check($s->mutate($u,$dup,$cat)['replayed']===true,'same receipt idempotent');
reject(fn()=>$s->mutate($u,array_merge($dup,['active'=>false]),$cat),409);
reject(fn()=>act(['kind'=>'assign','source'=>'1:11','id'=>$vip,'active'=>false,'revision'=>0]),409);
act(['kind'=>'assign','source'=>'1:g7','id'=>$vip,'active'=>false]);check($s->read($u,$cat)['assignments']->{'3:g8'}===[],'remove shared across group');
$preview=$s->preview($u,$cat);$mapping=[['key'=>'100:label:1','name'=>'Imported','color'=>'#0068ff','targetId'=>null,'skip'=>false]];
act(['kind'=>'import','batchId'=>$preview['id'],'mapping'=>$mapping]);$imported=tagId('Imported');
check(DB::table('zt_tag_assignments')->where('tag_id',$imported)->count()===2,'both source memberships imported');
act(['kind'=>'assign','source'=>'1:11','id'=>$imported,'active'=>true]);
act(['kind'=>'rollback','batchId'=>$preview['id']]);
check(DB::table('zt_tag_assignments')->where('source','100:11')->where('tag_id',$imported)->value('active')==1,'rollback preserves manual touch');
check(DB::table('zt_tag_assignments')->where('source','100:g7')->where('tag_id',$imported)->value('active')==0,'rollback removes untouched import');
$p2=$s->preview($u,$cat);act(['kind'=>'import','batchId'=>$p2['id'],'mapping'=>$mapping]);
act(['kind'=>'update','id'=>$imported,'name'=>'Renamed imported','color'=>'#0068ff']);
check($s->preview($u,$cat)['labels'][0]['targetId']===$imported,'native label mapping survives renaming shared tag');
check(DB::table('zt_tag_assignments')->where('source','100:g7')->where('tag_id',$imported)->value('active')==0,'reimport does not resurrect removed assignment');
$p3=$s->preview($u,$cat);$changed=$cat;$changed['labels'][0]['members']=[];reject(fn()=>act(['kind'=>'import','batchId'=>$p3['id'],'mapping'=>$mapping],null,$changed),409);
act(['kind'=>'merge','ids'=>[$imported],'targetId'=>$vip]);check(DB::table('zt_tags')->where('id',$imported)->value('archived')==1,'merge archives source');
check(in_array($vip,$s->read($u,$cat)['assignments']->{'1:11'}),'merge keeps destination');
act(['kind'=>'archive','id'=>$vip,'archived'=>true]);check($s->read($u,$cat)['assignments']->{'1:11'}===[],'archive hides tags');
act(['kind'=>'archive','id'=>$vip,'archived'=>false]);check(in_array($vip,$s->read($u,$cat)['assignments']->{'1:11'}),'restore retains memberships');
config(['zalo_team.workspace'=>'other']);check($s->read($u,$cat)['tags']===[],'workspace isolation');reject(fn()=>act(['kind'=>'assign','source'=>'1:11','id'=>$vip,'active'=>true]),404);
$secret=tempnam(sys_get_temp_dir(),'tags-test-');file_put_contents($secret,str_repeat('a',64));config(['zalo_team.connector_token_file'=>$secret,'zalo_team.connector_url'=>'http://tag-test.invalid']);
try {
 Illuminate\Support\Facades\Http::preventStrayRequests();
 Illuminate\Support\Facades\Http::fake(function($req){
   check($req['owner']===hash('sha256','zalo-team:local:1'),'connector scope derives from CRM identity');
   $v=match($req['action']){
     'status'=>['accounts'=>[['id'=>1,'externalId'=>'100','name'=>'Duy','status'=>'connected'],['id'=>3,'externalId'=>'200','name'=>'Anh','status'=>'offline']]],
     'conversations'=>['conversations'=>[],'groups'=>[]],
     'directory'=>$req['directory']['kind']==='friends'?['items'=>[['id'=>'11','name'=>'A']],'labels'=>[['id'=>'1','name'=>'Old','color'=>'#0068ff','members'=>['11','99']]]]:['items'=>[]],
     default=>throw new Exception('Unexpected connector command'),
   };return Illuminate\Support\Facades\Http::response($v);
 });
 $native=(new App\Services\ZaloTeamCatalog())->load($u);
 check($native['labels'][0]['pendingMembers']===['100:99'],'unresolved source references preserved');
 check($native['unavailable']===['Anh'],'offline account is pending not empty');
 $p=$s->preview($u,$native);check(!isset($p['labels'][0]['pendingMembers']),'preview does not expose unresolved identities');
 $snapshot=json_decode(DB::table('zt_tag_imports')->where('id',$p['id'])->value('snapshot'),true);
 check($snapshot['labels'][0]['pendingMembers']===['100:99'],'snapshot retains pending identities for reconciliation');
}finally{unlink($secret);}
echo "$checks tag checks passed\n";
