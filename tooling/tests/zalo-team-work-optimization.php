<?php
require __DIR__.'/zalo-team-collaboration.php';

use Illuminate\Support\Facades\DB;

$optimizationStart = $checks;
DB::table('zt_access_grants')->insert(['account_id'=>101,'user_id'=>4,'department_at_grant'=>10,'level'=>'operate','can_sync'=>false,'can_link'=>false]);
// Isolate the scheduling cases from earlier fixture tasks.
DB::table('zt_crm_tasks')->update(['status'=>'cancelled','next_repeat_at'=>null]);
$input = ['title'=>'Optimization fixture','taskAssigneeId'=>4,'description'=>'Internal','dueAt'=>'2026-10-09T11:00:00+07:00','repeat'=>'none'];
$created = change(3,'task_create',$input);
$workTask = DB::table('zt_crm_tasks')->where('title','Optimization fixture')->first();
$taskId = $workTask->id;

check(!collect(read(2)['taskCandidates'])->contains('id',5), 'leader task picker excludes cross-team recipients');
check(collect(read(1)['taskCandidates'])->contains('id',5), 'admin task picker includes eligible shared recipients');
check(collect(read(3)['taskCandidates'])->contains('id',5), 'conversation owner may assign eligible collaborators');
check(collect(read(4)['taskCandidates'])->pluck('id')->all()===[4], 'task assignee can only retain self without handoff authority');
check(read(6)['taskCandidates']===[], 'read-only viewer has no task assignment choices');
check($service->board(actor(4),['scope'=>'mine'])['items']->firstWhere('id',$taskId)['canEdit'], 'own task board exposes editing');
DB::table('zt_access_grants')->where('account_id',101)->where('user_id',4)->update(['level'=>'read']);
check(!$service->board(actor(4),['scope'=>'mine'])['items']->firstWhere('id',$taskId)['canEdit'], 'read-only downgrade hides task editing immediately');
DB::table('zt_access_grants')->where('account_id',101)->where('user_id',4)->update(['level'=>'operate']);
DB::beginTransaction();
$counterFixture=(array)$workTask;unset($counterFixture['id']);
for($n=0;$n<51;$n++)DB::table('zt_crm_tasks')->insert(array_replace($counterFixture,['title'=>'Counter '.$n]));
$counterRead=read(3);
check($counterRead['openTaskCount']===52 && count($counterRead['tasks'])===50 && $counterRead['hasMoreTasks'], 'open count stays exact beyond bounded task list');
DB::rollBack();

$assignmentCount = fn()=>DB::table('user_notifications')->where('entity_id',$taskId)->where('dedupe_key','like','zt-work:assign:%')->count();
check($assignmentCount()===1,'new task emits one assignment notification');
change(4,'task_edit',$input+['taskId'=>$taskId,'taskRevision'=>0]);
check($assignmentCount()===1,'editing task text does not repeat assignment notification');
$service->dispatchWorkReminders();
check(DB::table('zt_crm_tasks')->where('id',$taskId)->value('reminded_at')!==null,'deadline receipt is persisted on task');
$notificationCount=DB::table('user_notifications')->count();
DB::enableQueryLog();DB::flushQueryLog();$service->dispatchWorkReminders();$idleQueries=count(DB::getQueryLog());DB::disableQueryLog();
check(DB::table('user_notifications')->count()===$notificationCount && $idleQueries <= 4,'idle scheduler skips already reminded tasks without per-task transactions');
change(4,'task_status',['taskId'=>$taskId,'taskRevision'=>1,'taskStatus'=>'done']);
change(4,'task_status',['taskId'=>$taskId,'taskRevision'=>2,'taskStatus'=>'todo']);
check($service->dispatchWorkReminders()===1,'reopening overdue task creates one new reminder cycle');
check($service->dispatchWorkReminders()===0,'reopened task does not flood repeat reminders');
change(3,'task_edit',array_replace($input,['taskId'=>$taskId,'taskRevision'=>3,'taskAssigneeId'=>5]));
check(DB::table('user_notifications')->where('entity_id',$taskId)->where('user_id',4)->whereNull('resolved_at')->count()===0,'handoff resolves previous assignee notifications');
DB::table('zt_access_grants')->where('account_id',101)->where('user_id',5)->delete();
check($service->dispatchWorkReminders()===1,'shared-group reminder uses another authorized account after original access revoked');
check(str_contains(DB::table('user_notifications')->where('entity_id',$taskId)->where('user_id',5)->where('dedupe_key','like','zt-work:due:%')->value('action_url'),'workAccount=102'),'reminder destination is an authorized alias');

// Weekly roots must keep the next unprocessed date when editing title/description.
$weeklyInput=['title'=>'Stable weekly schedule','taskAssigneeId'=>3,'description'=>'Report','dueAt'=>'2026-10-01T09:00:00+07:00','repeat'=>'weekly','projectId'=>100];
change(3,'task_create',$weeklyInput);$weeklyTask=DB::table('zt_crm_tasks')->where('title','Stable weekly schedule')->first();
$service->dispatchWorkReminders();$weeklyTask=DB::table('zt_crm_tasks')->where('id',$weeklyTask->id)->first();
change(3,'task_edit',array_replace($weeklyInput,['title'=>'Updated weekly title','taskId'=>$weeklyTask->id,'taskRevision'=>$weeklyTask->revision]));
check(DB::table('zt_crm_tasks')->where('id',$weeklyTask->id)->value('next_repeat_at')===$weeklyTask->next_repeat_at,'text edit does not rewind processed weekly schedule');
$row=DB::table('zt_crm_tasks')->where('id',$weeklyTask->id)->first();
change(3,'task_status',['taskId'=>$row->id,'taskRevision'=>$row->revision,'taskStatus'=>'cancelled']);
change(3,'task_edit',array_replace($weeklyInput,['taskId'=>$row->id,'taskRevision'=>$row->revision+1,'taskStatus'=>'todo']));
check(DB::table('zt_crm_tasks')->where('id',$row->id)->value('next_repeat_at')>'2026-10-09 05:00:00','reopening cancelled weekly schedule starts at future occurrence');

$presenceInput=['accountId'=>101,'conversationId'=>'g11','sessionId'=>'optimization-typing-1','presenceState'=>'typing'];
$service->presence(actor(3),$presenceInput);
DB::table('zt_access_grants')->where('account_id',101)->where('user_id',3)->update(['level'=>'read']);
$items=$service->presence(actor(4),array_replace($presenceInput,['sessionId'=>'optimization-viewer-1','presenceState'=>'viewing']))['items'];
check(count($items)===1 && !$items[0]['typing'],'read-only downgrade removes typing status immediately');
DB::table('users')->where('id',3)->update(['department_id'=>20]);
check(count($service->presence(actor(4),array_replace($presenceInput,['sessionId'=>'optimization-viewer-1','presenceState'=>'viewing']))['items'])===0,'presence SQL excludes users moved to another department');
DB::table('users')->where('id',3)->update(['department_id'=>10]);
DB::table('zt_access_accounts')->where('account_id',101)->update(['external_id'=>'replacement']);
check(count($service->presence(actor(5),['accountId'=>102,'conversationId'=>'g22','sessionId'=>'optimization-viewer-2','presenceState'=>'viewing'])['items'])===0,'presence excludes leases from replaced account identity');
check(!collect(App\Services\ZaloTeamRuntime::migrationPaths())->contains(fn($p)=>str_contains($p,'optimize_zalo_crm_reminders')),'optimization migration remains CRM-only');
echo 'PASS '.($checks-$optimizationStart)." optimization checks; idle scheduler $idleQueries queries\n";
