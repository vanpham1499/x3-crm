<?php
// Isolated SQLite; never contacts Zalo/Drive or modifies real history.
putenv('ZALO_TEAM_RUNTIME=zalo');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use App\Services\ZaloTeamInboxPreferences;
use App\Models\ZaloTeamIdentityUser;
config(['database.default'=>'inbox_test','database.connections.inbox_test'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>''],
    'zalo_team.storage_owner'=>str_repeat('a',64)]);
Illuminate\Support\Facades\Http::preventStrayRequests();
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_08_000211_create_zalo_team_inbox_preferences.php')->up();
function actor($id,$accounts) { $u=new ZaloTeamIdentityUser; $u->forceFill(['id'=>$id,'is_active'=>true,'zalo_access'=>['owner'=>str_repeat('a',64),'admin'=>false,'accounts'=>$accounts]]); return $u; }
function check($v,$label) { if(!$v)throw new Exception($label); }
$p=new ZaloTeamInboxPreferences;
$a=actor(1,[7=>['read'=>true],8=>['read'=>true]]);$b=actor(2,[7=>['read'=>true]]);
check($p->set($a,['7:g42'],true)['archived']===['7:g42'],'archive');
$p->set($a,['7:g42'],true);
check(DB::table('zt_inbox_archived')->count()===1,'repeat archive does not duplicate');
check($p->read($b)['archived']===[],'different CRM user remains unaffected');
$p->set($a,['8:g42'],true);
check(count($p->read($a)['archived'])===2,'same peer on different account is separate');
try {$p->set($b,['7:g9','8:g42'],true);throw new Exception('Expected denial');}
catch(Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e){check($e->getStatusCode()===403,'denied wrong account');}
check($p->read($b)['archived']===[],'all sources authorized before write');
check($p->read(actor(1,[7=>['read'=>true]]))['archived']===['7:g42'],'revoked account not disclosed');
check($p->set($a,['7:g42'],false)['archived']===['8:g42'],'restore only selected source');
check($p->set($a,['7:g42'],false)['archived']===['8:g42'],'repeat restore is safe');
config(['zalo_team.storage_owner'=>str_repeat('b',64)]);
$other=actor(1,[7=>['read'=>true]]);$other->setAttribute('zalo_access',['admin'=>true,'owner'=>str_repeat('b',64)]);
check($p->read($other)['archived']===[],'workspace isolation');
echo "PASS: personal archive, restore, idempotence, account/user/workspace isolation and revocation\n";
