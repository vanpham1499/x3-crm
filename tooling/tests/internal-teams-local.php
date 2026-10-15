<?php
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $e): void { fwrite(STDERR, (string) $e); exit(1); });
if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.host') !== '127.0.0.1'
    || (string) config('database.connections.pgsql.port') !== '5433') throw new RuntimeException('Local DB 127.0.0.1:5433 only');

use App\Models\{User, Team, TeamMembership, Department, Project, Customer, Lead, Quotation, WeeklyReport, Role};
use App\Services\{TeamsService, TeamKpiService, KpiService, DashboardService, RolesService, UsersService, NotificationRecipientResolver};
use App\Policies\{ProjectPolicy, WeeklyReportPolicy};
use App\Repositories\{ProjectRepository, CustomerRepository, LeadRepository, WeeklyReportRepository};
use App\Support\TeamScope;
use Carbon\CarbonImmutable as Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

$checks = 0;
function ok($condition, string $label): void { global $checks; if (!$condition) throw new RuntimeException($label); $checks++; }
function denied(callable $f, string $label): void { try { $f(); } catch (AuthorizationException|ValidationException $e) { ok(true,$label); return; } throw new RuntimeException('Expected denial: '.$label); }
function viewer(User $user, array $query = []): void {
    $r = Illuminate\Http\Request::create('/api/test', 'GET', $query);
    app()->instance('request', $r); $r->setUserResolver(fn () => $user);
}
function grants(User $user, array $codes): User {
    $clone = User::findOrFail($user->id);
    (new ReflectionProperty(User::class,'permissionCodesCache'))->setValue($clone, collect($codes));
    return $clone;
}

DB::beginTransaction();
try {
    $admin = User::where('role','ADMIN')->firstOrFail(); viewer($admin);
    ok($admin->hasPermission('team.create') && $admin->hasPermission('project.view_team'), 'Migration grants admin group permissions');
    $dept = Department::firstOrFail()->replicate(); $dept->name='Group test '.Str::random(8); $dept->leader_user_id=null; $dept->saveQuietly();
    $dept2 = $dept->replicate(); $dept2->name.=' outside'; $dept2->saveQuietly();
    $makeUser = function ($department) use ($admin) {
        $u=$admin->replicate(); $u->name='Group test '.Str::random(7); $u->code='GT'.Str::random(10);
        $u->email=Str::random(14).'@example.invalid'; $u->department_id=$department; $u->team_id=null; $u->is_active=true; $u->saveQuietly(); return $u;
    };
    $leader=$makeUser($dept->id); $member=$makeUser($dept->id); $outside=$makeUser($dept->id); $foreign=$makeUser($dept2->id);
    $svc=app(TeamsService::class);
    Illuminate\Support\Carbon::setTestNow('2088-10-01 00:00:00');
    $a=$svc->save(null,['name'=>'A','departmentId'=>$dept->id,'leaderUserId'=>$leader->id,'memberUserIds'=>[$member->id]]);
    $aId=(int)$a['id'];
    ok($member->fresh()->team_id===$aId && $leader->fresh()->team_id===$aId,'Primary membership and leader auto-added');
    ok(TeamMembership::where('team_id',$aId)->whereNull('ended_at')->count()===2,'Membership starts recorded');
    $b=$svc->save(null,['name'=>'B','departmentId'=>$dept->id,'leaderUserId'=>$leader->id,'memberUserIds'=>[$outside->id]]); $bId=(int)$b['id'];
    ok($leader->fresh()->team_id===$aId && count($leader->fresh()->accessibleTeamIds())===2,'Leader manages two groups without moving primary group');
    denied(fn ()=>$svc->save(null,['name'=>'Invalid','departmentId'=>$dept->id,'leaderUserId'=>$foreign->id,'memberUserIds'=>[]]),'Cross-department leader rejected');
    denied(fn ()=>$svc->remove($aId),'Non-empty group cannot be deleted');
    $codes=['project.view','project.view_team','project.update','project.update_team','customer.view','customer.view_team','lead.view','lead.view_team','weeklyreport.view','weeklyreport.view_team','weeklyreport.approve','weeklyreport.approve_team','kpi.view','kpi.view_team','kpi.manage_team'];
    $scoped=grants($member,$codes); viewer($scoped);
    ok(TeamScope::selected($scoped,'project')===[$aId],'Group scope selects primary group');
    viewer($scoped,['team_id'=>$bId]); denied(fn()=>TeamScope::selected($scoped,'project'),'Foreign team query denied'); viewer($scoped);
    $makeProject=function ($owner) {
        $p=Project::firstOrFail()->replicate(); $p->project_code='GROUP-'.Str::random(12); $p->quotation_id=null; $p->manager_user_id=$owner->id; $p->sales_user_id=$owner->id; $p->created_at='2088-10-02'; $p->saveQuietly();return $p;
    };
    $pa=$makeProject($leader); $pb=$makeProject($outside);
    $policy=new ProjectPolicy;
    ok($policy->view($scoped,$pa) && !$policy->view($scoped,$pb),'Project detail group boundary');
    ok(!$policy->delete($scoped,$pa),'View or update never implies delete');
    $ids=app(ProjectRepository::class)->findAll([], $scoped)->pluck('id');
    ok($ids->contains($pa->id) && !$ids->contains($pb->id),'Project list matches detail scope');
    ok(request()->user()->id === $scoped->id && !request()->user()->hasPermission('project.view_all'),'Request user uses fixture scope');
    $lookup=app(UsersService::class)->findLookup([], 'project');
    ok(collect($lookup)->pluck('id')->contains($leader->id) && !collect($lookup)->pluck('id')->contains($outside->id),'Assignee lookup excludes other group '.json_encode(['actual'=>collect($lookup)->pluck('id'),'leader'=>$leader->id,'outside'=>$outside->id]));
    $report=new WeeklyReport(['reporter_user_id'=>$leader->id]); $report->setRelation('reporter',$leader->fresh()); $report->setRelation('project',$pa);
    ok((new WeeklyReportPolicy)->approve($scoped,$report),'Explicit group approve allows teammate report');
    $report->reporter_user_id=$member->id; $report->setRelation('reporter',$member->fresh());
    ok(!(new WeeklyReportPolicy)->approve($scoped,$report),'Group approval disallows self approval');
    $readOnly=grants($leader,['weeklyreport.view','weeklyreport.view_team']);
    ok(!(new WeeklyReportPolicy)->approve($readOnly,$report),'Leader title does not grant approval');
    $normalizer=new ReflectionMethod(RolesService::class,'normalizePermissionIds');
    $ids=$normalizer->invoke(app(RolesService::class),[DB::table('permissions')->where('code','project.update_team')->value('id')]);
    $normalized=DB::table('permissions')->whereIn('id',$ids)->pluck('code');
    ok($normalized->contains('project.update') && $normalized->contains('project.view_team') && !$normalized->contains('project.update_department'),'Role normalization keeps selected scope');

    // Every scoped repository result must also pass its detail policy.
    $matrix=[
        ['customer',App\Repositories\CustomerRepository::class,App\Policies\CustomerPolicy::class],
        ['lead',App\Repositories\LeadRepository::class,App\Policies\LeadPolicy::class],
        ['quotation',App\Repositories\QuotationRepository::class,App\Policies\QuotationPolicy::class],
        ['cost',App\Repositories\ProjectCostRepository::class,App\Policies\ProjectCostPolicy::class],
    ];
    foreach($matrix as [$module,$repository,$policyClass]) {
        $u=grants($member,[$module.'.view',$module.'.view_team']); viewer($u);
        $records=app($repository)->findAll([],$u);
        ok($records->every(fn($row)=>(new $policyClass)->view($u,$row)),$module.' list and detail agree');
    }
    $u=grants($member,['weeklyreport.view','weeklyreport.view_team']); viewer($u);
    ok(app(WeeklyReportRepository::class)->findAll($u)->every(fn($r)=>(new WeeklyReportPolicy)->view($u,$r)),'Weekly report list and detail agree');
    $u=grants($member,['p2point.view','p2point.view_team']); viewer($u);
    ok(app(App\Repositories\P2PointRepository::class)->findAll($u)->every(fn($p)=>(new App\Policies\P2PointPolicy)->view($u,$p)),'P2 list and detail agree');
    $u=grants($member,['meeting.view','meeting.view_team']); viewer($u);
    ok(app(App\Repositories\MeetingRepository::class)->findVisible($u)->every(fn($m)=>(new App\Policies\MeetingPolicy)->view($u,$m)),'Meeting list and detail agree');
    foreach ([['cost',new App\Models\ProjectCost, new App\Policies\ProjectCostPolicy],['quotation',new Quotation,new App\Policies\QuotationPolicy]] as [$module,$record,$recordPolicy]) {
        $u=grants($member,[$module.'.view',$module.'.view_team']);
        $record->project_id=$pa->id; $record->setRelation('project',$pa);
        ok($recordPolicy->view($u,$record),$module.' own group detail allowed');
        $record->project_id=$pb->id; $record->setRelation('project',$pb);
        ok(!$recordPolicy->view($u,$record),$module.' foreign group detail denied');
    }
    viewer($admin);
    $notifyRole=new Role(['name'=>'TEAM_TEST_'.Str::random(8),'description'=>'Rollback test']); $notifyRole->saveQuietly();
    $permissionIds=DB::table('permissions')->whereIn('code',['weeklyreport.approve','weeklyreport.approve_team','weeklyreport.view','weeklyreport.view_team'])->pluck('id');
    foreach($permissionIds as $id) DB::table('role_permissions')->insert(['role_id'=>$notifyRole->id,'permission_id'=>$id]);
    DB::table('users')->whereIn('id',[$member->id,$outside->id])->update(['role_id'=>$notifyRole->id]);
    $report->reporter_user_id=$leader->id; $report->setRelation('reporter',$leader->fresh());
    $recipients=app(NotificationRecipientResolver::class)->weeklyReportApprovers($report)->pluck('id');
    ok($recipients->contains($member->id) && !$recipients->contains($outside->id),'Approval notifications are confined to authorized groups, no messages sent');

    viewer($admin); Illuminate\Support\Carbon::setTestNow('2088-10-15 00:00:00');
    $move=['name'=>'B','departmentId'=>$dept->id,'leaderUserId'=>$leader->id,'memberUserIds'=>[$outside->id,$member->id]];
    denied(fn()=>$svc->save($bId,$move),'Transfer requires explicit confirmation');
    $svc->save($bId,$move+['confirmTransfers'=>true]);
    ok($member->fresh()->team_id===$bId && TeamMembership::where('user_id',$member->id)->whereNull('ended_at')->count()===1,'Transfer keeps exactly one open membership');
    $old=TeamMembership::where('user_id',$member->id)->where('team_id',$aId)->firstOrFail();
    ok($old->ended_at->format('Y-m-d')==='2088-10-15','Previous membership closes on transfer');
    $q=new Quotation; $q->id=991; $q->quotation_code='TEST-Q'; $q->setRelation('project',$pa);
    $basis=['managerId'=>$member->id,'salesId'=>$leader->id,'firstQuotation'=>true];
    $event=fn($id,$at,$amount)=>['id'=>$id,'at'=>Date::parse($at),'refund'=>$amount<0,'amount'=>$amount,'sourceAmount'=>abs($amount)*1.08,'reference'=>'TEST','basis'=>$basis,'quotation'=>$q,'projectId'=>$pa->id];
    $events=collect([$event('fee-receipt-1','2088-10-10',100),$event('fee-receipt-2','2088-10-16',50),$event('fee-refund-1','2088-10-18',-120)]);
    $credits=TeamKpiService::allocate($events,TeamMembership::whereIn('user_id',[$leader->id,$member->id])->get()->groupBy('user_id'));
    ok((float)$credits->where('branch','implementation')->where('teamId',$aId)->sum('creditAmount')===0.0,'Refund reverses original team first');
    ok((float)$credits->where('branch','implementation')->where('teamId',$bId)->sum('creditAmount')===30.0,'New receipts go to new team, excess refund reverses next lot');
    ok((float)$credits->where('branch','acquisition')->where('teamId',$aId)->sum('creditAmount')===30.0,'Sale credits tracked independently');
    $unknown=TeamKpiService::allocate(collect([$event('fee-receipt-0','2088-09-10',12)]),TeamMembership::all()->groupBy('user_id'));
    ok($unknown->every(fn($c)=>$c['teamId']===null),'Past receipts are never assigned to current membership');

    $scoped=grants($leader,$codes); viewer($scoped,['team_id'=>$aId]);
    $fake=new class(app(App\Repositories\KpiReportRepository::class),app(App\Repositories\KpiTargetRepository::class)) extends KpiService {
        public Illuminate\Support\Collection $testEvents;
        public function feeEvents(string $from,string $to): Illuminate\Support\Collection { return $this->testEvents; }
    };
    $fake->testEvents=$events; app()->instance(KpiService::class,$fake);
    $fake->upsertTarget(['scopeType'=>'team','scopeId'=>$aId,'period'=>'2088-10','targetAmount'=>100]);
    $data=$fake->report('2088-10','2088-10',$scoped); $month=collect($data['periods'])->first();
    ok($data['viewerScope']['level']==='team' && (float)$month['summary']['departments']['actualAmount']===30.0,'Group report sums attributed credits');
    ok((float)$month['summary']['departments']['targetAmount']===100.0,'Group month target');
    $detail=$fake->detail('2088-10','team',$aId,$scoped);
    ok((float)$detail['totals']['profitAmount']===30.0,'Detail and summary reconcile');
    $detailEntries=collect($detail['branches'])->flatMap(fn($b)=>$b['entries']);
    ok($detailEntries->where('kind','acquisition_credit')->count()===2,'Detail preserves Sale branch entry types');
    ok((float)$detailEntries->firstWhere('kind','received')['sourceAmount']===108.0,'Source gross amount is distinct from fee before VAT');
    $employeeDetail=$fake->detail('2088-10','employee',$member->id,$scoped);
    ok((float)$employeeDetail['totals']['profitAmount']===0.0,'Selected group employee detail excludes new group credit');
    denied(fn()=>$fake->detail('2088-10','employee',$foreign->id,$scoped),'Foreign employee detail denied');
    $dash=app(DashboardService::class)->report('2088-10','2088-10');
    ok($dash['scope']['level']==='team' && $dash['scope']['teamIds']===[$aId],'Dashboard group scope');
    // Current mocked date is 15th: receipt on the 10th is 100 for each branch; later events excluded.
    ok((float)$dash['profitTrend']['currentAmount']===200.0,'Dashboard cumulative cutoff uses group-at-receipt credits');
    ok((float)$dash['summary']['targetAmount']===100.0,'Dashboard group plan agrees with KPI');
    viewer($admin,['team_id'=>$aId]);
    $dashAdmin=app(DashboardService::class)->report('2088-10','2088-10');
    ok($dashAdmin['scope']['level']==='team','All-scope admin can drill down into one group');
    $meetingFiltered=app(App\Services\MeetingsService::class)->summary([]);
    ok(array_sum($meetingFiltered)===0,'An empty group scope cannot expose whole-company meeting counts');
    $weeklyFiltered=app(App\Services\WeeklyReportsService::class)->board([],1,1,[]);
    ok(count($weeklyFiltered['data'])===0,'An empty group scope cannot expose whole-company weekly reports');
    viewer(grants($outside,['kpi.view','kpi.view_team','kpi.manage_team']));
    denied(fn()=>$fake->upsertTarget(['scopeType'=>'team','scopeId'=>$aId,'period'=>'2088-10','targetAmount'=>9]),'Foreign group target denied');

    viewer($admin); $member=$member->fresh(); $member->department_id=$dept2->id; $member->save();
    ok($member->fresh()->team_id===null && TeamMembership::where('user_id',$member->id)->whereNull('ended_at')->count()===0,'Department move closes group membership');
    $leader=$leader->fresh(); $leader->department_id=$dept2->id; $leader->save();
    ok(Team::whereIn('id',[$aId,$bId])->whereNotNull('leader_user_id')->count()===0,'Department move removes incompatible leadership');
    $svc->remove($aId);
    ok(Team::withTrashed()->find($aId)->trashed() && TeamMembership::where('team_id',$aId)->count()===2,'Deleting empty team preserves history');
    echo "PASS $checks checks; all fixture writes rolled back.\n";
} finally { DB::rollBack(); Illuminate\Support\Carbon::setTestNow(); }
