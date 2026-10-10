<?php

namespace App\Services;

use App\Events\UserNotificationsChanged;
use App\Models\Project;
use App\Models\User;
use App\Models\UserNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/** CRM-only collaboration; never sends messages through the Zalo connector. */
trait ZaloTeamCollaboration
{
    private function iso($value): ?string
    {
        return $value ? CarbonImmutable::parse($value, config('app.timezone'))->toIso8601String() : null;
    }

    private function collaboration(User $user, int $account, string $id, ?int $taskId = null): array
    {
        $people = $this->operators($account)->orderBy('name')->get(['id', 'name']);
        $notes = DB::table('zt_crm_notes as n')->leftJoin('users as u', 'u.id', '=', 'n.author_id')
            ->where('n.workspace_id', $id)->orderByDesc('n.id')->limit(21)->get(['n.*', 'u.name as author']);
        $tasks = DB::table('zt_crm_tasks as t')->leftJoin('users as u', 'u.id', '=', 't.assignee_id')
            ->where('t.workspace_id', $id)->orderByRaw("CASE WHEN t.status IN ('done','cancelled') THEN 1 ELSE 0 END")
            ->orderBy('t.due_at')->orderBy('t.id')->limit(51)->get(['t.*', 'u.name as assignee']);

        $selectedTask = $taskId ? DB::table('zt_crm_tasks as t')->leftJoin('users as u', 'u.id', '=', 't.assignee_id')->where('t.workspace_id', $id)->where('t.id', $taskId)->first(['t.*', 'u.name as assignee']) : null;
        abort_if($taskId && ! $selectedTask, 404, 'Công việc không thuộc hội thoại này.');
        $visibleProjects = $this->visibleTaskProjects($user, $selectedTask ? $tasks->concat([$selectedTask]) : $tasks);

        return ['colleagues' => $people, 'canCollaborate' => $this->canWrite($user, $account), 'userId' => $user->id,
            'openTaskCount' => DB::table('zt_crm_tasks')->where('workspace_id', $id)->whereIn('status', ['todo', 'doing'])->count(),
            'selectedTask' => $selectedTask ? $this->taskView($selectedTask, $account, $visibleProjects) : null,
            'notes' => $notes->take(20)->map(fn ($n) => $this->noteView($n))->values(), 'hasMoreNotes' => $notes->count() > 20,
            'tasks' => $tasks->take(50)->map(fn ($t) => $this->taskView($t, $account, $visibleProjects))->values(), 'hasMoreTasks' => $tasks->count() > 50];
    }

    private function noteView(object $n): array
    {
        return ['id' => $n->id, 'body' => $n->body, 'author' => $n->author ?? 'Nhân sự đã ngừng hoạt động',
            'authorId' => $n->author_id, 'mentions' => json_decode($n->mentions, true), 'at' => $this->iso($n->created_at)];
    }

    public function notes(User $user, int $account, string $peer, int $before): array
    {
        $id = $this->source($user, $account, $peer)?->workspace_id ?? $this->resolve($user, $account, $peer);
        abort_unless(DB::table('zt_crm_workspaces')->where('id', $id)->where('owner', ZaloTeamAccess::storageOwner())->exists(), 404);
        $rows = DB::table('zt_crm_notes as n')->leftJoin('users as u', 'u.id', '=', 'n.author_id')->where('workspace_id', $id)
            ->when($before, fn ($q) => $q->where('n.id', '<', $before))->orderByDesc('n.id')->limit(21)->get(['n.*', 'u.name as author']);

        return ['items' => $rows->take(20)->map(fn ($n) => $this->noteView($n))->values(), 'hasMore' => $rows->count() > 20];
    }

    private function visibleTaskProjects(User $user, $tasks): array
    {
        $ids = $tasks->pluck('project_id')->filter()->unique();
        if ($ids->isEmpty()) {
            return [];
        }

        return Project::with(['salesUser', 'managerUser'])->whereIn('id', $ids)->get()
            ->filter(fn ($p) => $this->allowed($user, 'project', $p))->pluck('id')->all();
    }

    private function taskView(object $t, int $account, array $visibleProjects): array
    {
        // A source on a different account must not leak that account's message identifiers.
        return ['id' => $t->id, 'title' => $t->title, 'description' => $t->description, 'status' => $t->status,
            'assigneeId' => (int) $t->assignee_id, 'assignee' => $t->assignee ?? 'Nhân sự không còn hoạt động',
            'dueAt' => $this->iso($t->due_at), 'repeat' => $t->repeat, 'revision' => (int) $t->revision,
            'sourceMessageId' => (int) $t->source_account_id === $account ? $t->source_message_id : null,
            'sourceMessageTime' => (int) $t->source_account_id === $account ? $t->source_message_time : null,
            'projectId' => in_array($t->project_id, $visibleProjects) ? $t->project_id : null,
            'overdue' => ! in_array($t->status, ['done', 'cancelled']) && CarbonImmutable::parse($t->due_at)->isPast()];
    }

    private function notifyWork(int $person, string $key, string $title, int $account, string $peer, ?int $taskId = null): bool
    {
        // Generic notification text remains safe even after later revocation. Destination rechecks ACL.
        $notification = UserNotification::firstOrCreate(['user_id' => $person, 'dedupe_key' => 'zt-work:'.$key], [
            'module' => 'zalo-team', 'event_key' => 'zalo_team.work', 'title' => $title,
            'message' => 'Mở Zalo Team để xem chi tiết theo quyền hiện tại.', 'kind' => 'action', 'severity' => 'info',
            'action_url' => '/zalo-team?workAccount='.$account.'&workPeer='.rawurlencode($peer),
            'entity_type' => $taskId ? 'zalo_work_task' : null, 'entity_id' => $taskId,
        ]);
        if ($notification->wasRecentlyCreated) {
            DB::afterCommit(fn () => rescue(fn () => UserNotificationsChanged::dispatch($person, 'created', $notification->id), null, report: true));
        }

        return $notification->wasRecentlyCreated;
    }

    private function collaborateMutation(User $user, array $v, object $work, bool $manage): array
    {
        $account = $v['accountId'];
        $peer = $v['conversationId'];
        if ($v['kind'] === 'note') {
            abort_unless(trim($v['body']) !== '', 422, 'Nhập nội dung ghi chú.');
            $mentions = array_values(array_unique($v['mentions'] ?? []));
            $people = $this->operators($account)->whereIn('id', $mentions)->get(['id', 'name']);
            abort_unless($people->count() === count($mentions), 422, 'Người được nhắc phải có quyền thao tác tài khoản.');
            $id = DB::table('zt_crm_notes')->insertGetId(['workspace_id' => $work->id, 'author_id' => $user->id,
                'body' => trim($v['body']), 'mentions' => $people->toJson(), 'created_at' => now(), 'updated_at' => now()]);
            foreach ($people as $p) {
                if ($p->id !== $user->id) {
                    $this->notifyWork($p->id, 'note:'.$id, 'Bạn được nhắc trong ghi chú Zalo Team', $account, $peer);
                }
            }

            return ['noteId' => $id];
        }

        $task = isset($v['taskId']) ? DB::table('zt_crm_tasks')->where('workspace_id', $work->id)->where('id', $v['taskId'])->lockForUpdate()->first() : null;
        abort_if($v['kind'] !== 'task_create' && ! $task, 404, 'Công việc không còn tồn tại.');
        $owner = (int) $this->assignee($work)?->id === (int) $user->id;
        abort_unless($manage || $owner || ($task && (int) $task->assignee_id === (int) $user->id), 403, 'Người phụ trách, người nhận việc hoặc quản lý được cập nhật.');
        if ($task) {
            abort_unless((int) $task->revision === $v['taskRevision'], 409, 'Công việc vừa thay đổi. Tải lại trước khi lưu.');
        }
        if ($v['kind'] === 'task_status') {
            $nextRepeat = $task->next_repeat_at;
            if ($task->repeat === 'weekly' && $task->status === 'cancelled' && $v['taskStatus'] !== 'cancelled') {
                $next = CarbonImmutable::parse($task->due_at)->addWeek();
                while ($next->isPast()) {
                    $next = $next->addWeek();
                }
                $nextRepeat = $next;
            }
            $reopened = in_array($task->status, ['done', 'cancelled']) && in_array($v['taskStatus'], ['todo', 'doing']);
            DB::table('zt_crm_tasks')->where('id', $task->id)->update(($reopened ? ['reminded_at' => null, 'reminder_cycle' => $task->reminder_cycle + 1] : []) + ['status' => $v['taskStatus'], 'revision' => $task->revision + 1,
                'next_repeat_at' => $v['taskStatus'] === 'cancelled' ? null : $nextRepeat, 'updated_at' => now()]);
            if (in_array($v['taskStatus'], ['done', 'cancelled'])) {
                UserNotification::where('entity_type', 'zalo_work_task')->where('entity_id', $task->id)->whereNull('resolved_at')->update(['resolved_at' => now()]);
            }

            return ['taskId' => $task->id, 'status' => $v['taskStatus']];
        }
        $person = $this->operators($account)->where('id', $v['taskAssigneeId'])->first();
        abort_unless($person, 422, 'Người nhận việc cần có quyền thao tác tài khoản.');
        abort_if(! $manage && ! $owner && (int) $person->id !== (int) $user->id, 403, 'Nhờ người phụ trách hoặc quản lý bàn giao việc.');
        abort_if($manage && ! $user->isAdmin() && (int) $person->department_id !== (int) $this->account($user, $account)->department_id, 403, 'Chỉ giao việc trong đội quản lý.');
        $repeat = $v['repeat'] ?? 'none';
        $project = null;
        if ($v['projectId'] ?? null) {
            $project = $this->entity('project', $v['projectId']);
            abort_unless($project && $this->allowed($user, 'project', $project) && DB::table('zt_crm_workspace_links')->where(['workspace_id' => $work->id, 'kind' => 'project', 'entity_id' => $project->id])->exists(), 404, 'Chọn dự án đã liên kết và thuộc quyền xem của bạn.');
        }
        abort_if($repeat !== 'none' && ! $project, 422, 'Chọn dự án cho nhắc báo cáo tuần hoặc gia hạn.');
        $due = CarbonImmutable::parse($v['dueAt'])->setTimezone(config('app.timezone'));
        if ($repeat === 'renewal') {
            abort_unless($project?->end_date, 422, 'Dự án chưa có ngày hết hạn.');
            $due = CarbonImmutable::parse($project->end_date->format('Y-m-d'), 'Asia/Ho_Chi_Minh')->subDays(7)->setTime(9, 0)->setTimezone(config('app.timezone'));
        }
        $messageId = $task?->source_message_id;
        if (! $task && ! empty($v['sourceMessageId'])) {
            $messageId = $v['sourceMessageId'];
        }
        $values = ['assignee_id' => $person->id, 'title' => trim($v['title']), 'description' => $v['description'] ?? null,
            'due_at' => $due, 'project_id' => $project?->id, 'repeat' => $repeat,
            'next_repeat_at' => $repeat === 'weekly' ? $due->addWeek() : null, 'updated_at' => now()];
        abort_unless($values['title'] !== '', 422, 'Nhập tên công việc.');
        if ($task) {
            $dueChanged = ! CarbonImmutable::parse($task->due_at)->equalTo($due);
            $reassigned = (int) $task->assignee_id !== (int) $person->id;
            $reopened = in_array($task->status, ['done', 'cancelled']) && in_array($v['taskStatus'] ?? $task->status, ['todo', 'doing']);
            // Editing text must not rewind a weekly schedule that the worker already advanced.
            if ($repeat === 'weekly' && $task->repeat === 'weekly' && ! $dueChanged && ! $reopened) {
                $values['next_repeat_at'] = $task->next_repeat_at;
            }
            if ($repeat === 'weekly' && $reopened && $values['next_repeat_at']) {
                $next = CarbonImmutable::parse($values['next_repeat_at']);
                while ($next->isPast()) {
                    $next = $next->addWeek();
                }
                $values['next_repeat_at'] = $next;
            }
            if ($dueChanged || $reassigned || $reopened) {
                $values['reminded_at'] = null;
                $values['reminder_cycle'] = $task->reminder_cycle + 1;
                UserNotification::where('entity_type', 'zalo_work_task')->where('entity_id', $task->id)->whereNull('resolved_at')->update(['resolved_at' => now()]);
            }
            if (isset($v['taskStatus'])) {
                $values['status'] = $v['taskStatus'];
                if ($v['taskStatus'] === 'cancelled') {
                    $values['next_repeat_at'] = null;
                }
                if (in_array($v['taskStatus'], ['done', 'cancelled'])) {
                    UserNotification::where('entity_type', 'zalo_work_task')->where('entity_id', $task->id)->whereNull('resolved_at')->update(['resolved_at' => now()]);
                }
            }
            DB::table('zt_crm_tasks')->where('id', $task->id)->update($values + ['revision' => $task->revision + 1]);
            $id = $task->id;
        } else {
            $id = DB::table('zt_crm_tasks')->insertGetId($values + ['workspace_id' => $work->id, 'created_by' => $user->id,
                'status' => 'todo', 'source_account_id' => $account, 'source_conversation_id' => $peer,
                'source_message_id' => $messageId, 'source_message_time' => $v['sourceMessageTime'] ?? null, 'created_at' => now()]);
        }
        if ((! $task || $reassigned || $reopened) && ! in_array($values['status'] ?? $task?->status ?? 'todo', ['done', 'cancelled'])) {
            $this->notifyWork($person->id, 'assign:'.$id.':'.($task ? $task->revision + 1 : 0), 'Bạn có công việc trong Zalo Team', $account, $peer, $id);
        }

        return ['taskId' => $id];
    }

    public function presence(User $user, array $v): array
    {
        $a = $this->account($user, $v['accountId']);
        $id = $this->source($user, $v['accountId'], $v['conversationId'])?->workspace_id;
        if (! $id) {
            $key = 'zt-presence-id:'.ZaloTeamAccess::storageOwner().':'.$user->id.':'.$a->external_id.':'.$v['conversationId'];
            $id = Cache::remember($key, 60, fn () => $this->resolve($user, $v['accountId'], $v['conversationId']));
        }
        $where = ['workspace_id' => $id, 'user_id' => $user->id, 'session_id' => $v['sessionId']];
        if ($v['presenceState'] === 'leave') {
            DB::table('zt_crm_presence')->where($where)->delete();
        } else {
            DB::table('zt_crm_presence')->upsert([$where + ['account_id' => $a->account_id, 'external_id' => $a->external_id,
                'expires_at' => now()->addSeconds(55), 'typing_until' => $v['presenceState'] === 'typing' && $this->canWrite($user, $a->account_id) ? now()->addSeconds(12) : null]],
                ['workspace_id', 'user_id', 'session_id'], ['account_id', 'external_id', 'expires_at', 'typing_until']);
        }
        $rows = DB::table('zt_crm_presence as p')->join('users as u', 'u.id', '=', 'p.user_id')
            ->join('zt_access_accounts as a', fn ($j) => $j->on('a.account_id', '=', 'p.account_id')->on('a.external_id', '=', 'p.external_id'))
            ->leftJoin('departments as d', fn ($j) => $j->on('d.id', '=', 'a.department_id')->whereNull('d.deleted_at'))
            ->leftJoin('zt_access_grants as g', fn ($j) => $j->on('g.account_id', '=', 'p.account_id')->on('g.user_id', '=', 'p.user_id')->on('g.department_at_grant', '=', 'u.department_id'))
            ->where('p.workspace_id', $id)->where('p.user_id', '!=', $user->id)->where('p.expires_at', '>', now())
            ->whereNull('u.deleted_at')->where('u.is_active', true)
            ->where(fn ($q) => $q->where('u.role', User::ROLE_ADMIN)->orWhere(fn ($q) => $q->whereNotNull('d.id')->where(fn ($q) => $q->whereColumn('d.leader_user_id', 'u.id')->orWhereNotNull('g.user_id'))))
            ->selectRaw("p.user_id, u.name, MAX(CASE WHEN p.typing_until > ? AND (u.role = ? OR d.leader_user_id = u.id OR g.level = 'operate') THEN 1 ELSE 0 END) as typing", [now(), User::ROLE_ADMIN])
            ->groupBy('p.user_id', 'u.name')->get();
        $items = [];
        foreach ($rows as $row) {
            $items[] = ['id' => $row->user_id, 'name' => $row->name, 'typing' => (bool) $row->typing];
        }
        $revision = DB::table('zt_crm_workspaces')->where('id', $id)->where('owner', ZaloTeamAccess::storageOwner())->value('revision');

        return ['items' => array_values($items), 'revision' => (int) $revision];
    }

    /** Scope before aggregation/pagination; no connector reads and no duplicate global-group rows. */
    public function board(User $user, array $v): array
    {
        $scope = ZaloTeamAccess::scope($user);
        $abilityIds = fn (string $ability) => ($scope['admin'] ?? false) ? null : array_map('intval', array_keys(array_filter((array) ($scope['accounts'] ?? []), fn ($a) => ! empty($a[$ability]))));
        $manageIds = $abilityIds('manage');
        $writeIds = $abilityIds('write');
        $canManage = $manageIds === null || count($manageIds) > 0;
        $team = ($v['scope'] ?? 'mine') === 'team';
        abort_if($team && ! $canManage, 403, 'Màn điều hành chỉ dành cho quản lý.');
        $ids = $team ? $manageIds : $abilityIds('read');
        $sources = DB::table('zt_crm_workspace_sources as s')->join('zt_access_accounts as a', fn ($j) => $j->on('s.account_id', '=', 'a.account_id')->on('s.external_id', '=', 'a.external_id'))
            ->when($ids !== null, fn ($q) => $q->whereIn('s.account_id', $ids))->select('s.workspace_id');
        $base = DB::table('zt_crm_workspaces as w')->where('w.owner', ZaloTeamAccess::storageOwner())->whereIn('w.id', $sources);
        $tasks = DB::table('zt_crm_tasks as t')->whereIn('t.workspace_id', (clone $base)->select('w.id'))
            ->when(! $team, fn ($q) => $q->where('t.assignee_id', $user->id));
        $works = (clone $base)->when(! $team, fn ($q) => $q->where('w.assignee_id', $user->id));
        $active = fn ($q) => $q->whereIn('t.status', ['todo', 'doing']);
        $taskCounts = $active(clone $tasks)->selectRaw('COUNT(*) as open_count, COALESCE(SUM(CASE WHEN t.due_at < ? THEN 1 ELSE 0 END),0) as overdue_count', [now()])->first();
        $workCounts = (clone $works)->selectRaw("COALESCE(SUM(CASE WHEN w.state = 'needs_action' THEN 1 ELSE 0 END),0) as action_count, COALESCE(SUM(CASE WHEN w.state = 'waiting_customer' THEN 1 ELSE 0 END),0) as waiting_count, COALESCE(SUM(CASE WHEN w.assignee_id IS NULL THEN 1 ELSE 0 END),0) as unassigned_count")->first();
        $counts = ['openTasks' => (int) $taskCounts->open_count, 'overdue' => (int) $taskCounts->overdue_count,
            'needsAction' => (int) $workCounts->action_count, 'waitingCustomer' => (int) $workCounts->waiting_count, 'unassigned' => (int) $workCounts->unassigned_count];
        $view = $v['view'] ?? 'tasks';
        $page = $v['page'] ?? 0;
        $rows = $view === 'tasks'
            ? (clone $tasks)->leftJoin('users as u', 'u.id', '=', 't.assignee_id')->when(($v['taskFilter'] ?? 'open') === 'open', $active)
                ->when(! empty($v['personId']), fn ($q) => $q->where('t.assignee_id', $v['personId']))
                ->when(($v['taskFilter'] ?? '') === 'overdue', fn ($q) => $active($q)->where('t.due_at', '<', now()))
                ->when(($v['taskFilter'] ?? '') === 'done', fn ($q) => $q->whereIn('t.status', ['done', 'cancelled']))
                ->orderBy('t.due_at')->orderBy('t.id')->offset($page * 30)->limit(31)->get(['t.*', 'u.name as assignee'])
            : (clone $works)->leftJoin('users as u', 'u.id', '=', 'w.assignee_id')
                ->when(! empty($v['personId']), fn ($q) => $q->where('w.assignee_id', $v['personId']))
                ->when($v['unassigned'] ?? false, fn ($q) => $q->whereNull('w.assignee_id'))
                ->when(! empty($v['workState']), fn ($q) => $q->where('w.state', $v['workState']))
                ->orderBy('w.updated_at')->orderBy('w.id')->offset($page * 30)->limit(31)->get(['w.*', 'u.name as assignee']);
        $sourceRows = DB::table('zt_crm_workspace_sources as s')->join('zt_access_accounts as a', fn ($j) => $j->on('s.account_id', '=', 'a.account_id')->on('s.external_id', '=', 'a.external_id'))
            ->join('zt_crm_workspaces as sw', 'sw.id', '=', 's.workspace_id')
            ->whereIn('s.workspace_id', $rows->map(fn ($r) => $view === 'tasks' ? $r->workspace_id : $r->id))
            ->when($ids !== null, fn ($q) => $q->whereIn('s.account_id', $ids))->orderBy('s.account_id')->get(['s.*', 'a.name as accountName', 'sw.assignee_id as workspaceAssigneeId'])->groupBy('workspace_id');
        $visibleProjects = $view === 'tasks' ? $this->visibleTaskProjects($user, $rows->take(30)) : [];
        $items = $rows->take(30)->map(function ($r) use ($sourceRows, $view, $visibleProjects, $writeIds, $manageIds, $user) {
            $choices = $sourceRows->get($view === 'tasks' ? $r->workspace_id : $r->id);
            $s = ($view === 'tasks' ? $choices?->firstWhere('account_id', $r->source_account_id) : null) ?? $choices?->first();

            if (! $s) {
                return null;
            } // A concurrent account unlink must fail closed, not crash/leak a source.

            return ($view === 'tasks' ? $this->taskView($r, (int) $s->account_id, $visibleProjects) : ['id' => $r->id, 'state' => $r->state, 'assignee' => $r->assignee, 'updatedAt' => $this->iso($r->updated_at)])
                + ['canEdit' => $view === 'tasks' && ($writeIds === null || in_array((int) $s->account_id, $writeIds, true)) && ($manageIds === null || in_array((int) $s->account_id, $manageIds, true) || (int) $r->assignee_id === (int) $user->id || (int) $s->workspaceAssigneeId === (int) $user->id),
                    'accountId' => (int) $s->account_id, 'conversationId' => $s->conversation_id, 'conversationName' => $s->conversation_name ?: 'Hội thoại '.$s->conversation_id, 'accountName' => $s->accountName];
        })->filter()->values();
        $load = $team ? $active(clone $tasks)->leftJoin('users as u', 'u.id', '=', 't.assignee_id')->groupBy('t.assignee_id', 'u.name')
            ->selectRaw('t.assignee_id as id, u.name, COUNT(*) as total')->orderByDesc('total')->limit(100)->get() : [];

        return ['canManage' => $canManage, 'counts' => $counts, 'items' => $items, 'hasMore' => $rows->count() > 30, 'workload' => $load,
            'remindersReady' => (bool) Cache::get('zt-work-reminders:'.ZaloTeamAccess::storageOwner())];
    }

    public function dispatchWorkReminders(): int
    {
        $sent = 0;
        DB::table('zt_crm_presence')->where('expires_at', '<=', now())->delete();
        DB::table('zt_crm_tasks')->whereIn('workspace_id', DB::table('zt_crm_workspaces')->where('owner', ZaloTeamAccess::storageOwner())->select('id'))
            ->where(fn ($q) => $q->where(fn ($q) => $q->whereIn('status', ['todo', 'doing'])->whereNull('reminded_at')->where('due_at', '<=', now()))
                ->orWhere(fn ($q) => $q->whereIn('status', ['todo', 'doing'])->where('repeat', 'renewal'))
                ->orWhere(fn ($q) => $q->where('status', '!=', 'cancelled')->where('next_repeat_at', '<=', now())))
            ->orderBy('id')->chunkById(100, function ($rows) use (&$sent) {
                foreach ($rows as $row) {
                    DB::transaction(function () use ($row, &$sent) {
                        // Same order as interactive edits: workspace, then task.
                        $w = DB::table('zt_crm_workspaces')->where('id', $row->workspace_id)->where('owner', ZaloTeamAccess::storageOwner())->lockForUpdate()->first();
                        if (! $w) {
                            return;
                        }
                        $t = DB::table('zt_crm_tasks')->where('id', $row->id)->lockForUpdate()->first();
                        if (! $t || $t->status === 'cancelled') {
                            return;
                        }
                        $user = User::where('is_active', true)->find($t->assignee_id);
                        if (! $user) {
                            return;
                        }
                        $writeIds = ZaloTeamAccess::ids($user, 'write');
                        $source = DB::table('zt_crm_workspace_sources as s')->join('zt_access_accounts as a', fn ($j) => $j->on('s.account_id', '=', 'a.account_id')->on('s.external_id', '=', 'a.external_id'))
                            ->where('s.workspace_id', $t->workspace_id)->when($writeIds !== null, fn ($q) => $q->whereIn('s.account_id', $writeIds))
                            ->orderByRaw('CASE WHEN s.account_id = ? THEN 0 ELSE 1 END', [$t->source_account_id])->orderBy('s.account_id')->first(['s.*']);
                        if (! $source) {
                            return;
                        }
                        if ($t->project_id) {
                            $project = $this->entity('project', $t->project_id);
                            if (! $project || ! $this->allowed($user, 'project', $project) || ! DB::table('zt_crm_workspace_links')->where(['workspace_id' => $w->id, 'kind' => 'project', 'entity_id' => $t->project_id])->exists()) {
                                return;
                            }
                            if ($t->repeat === 'renewal') {
                                if (! $project->end_date) {
                                    return;
                                }
                                $due = CarbonImmutable::parse($project->end_date->format('Y-m-d'), 'Asia/Ho_Chi_Minh')->subDays(7)->setTime(9, 0)->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s');
                                if ($t->due_at !== $due) {
                                    DB::table('zt_crm_tasks')->where('id', $t->id)->update(['due_at' => $due, 'reminded_at' => null, 'reminder_cycle' => $t->reminder_cycle + 1, 'revision' => $t->revision + 1, 'updated_at' => now()]);
                                    UserNotification::where('entity_type', 'zalo_work_task')->where('entity_id', $t->id)->whereNull('resolved_at')->update(['resolved_at' => now()]);
                                    DB::table('zt_crm_workspaces')->where('id', $w->id)->increment('revision');
                                    $t->due_at = $due;
                                    $t->reminded_at = null;
                                    $t->reminder_cycle++;
                                }
                            }
                        }
                        if (! $t->reminded_at && in_array($t->status, ['todo', 'doing']) && CarbonImmutable::parse($t->due_at)->lessThanOrEqualTo(now())) {
                            $cycle = $t->reminder_cycle ? ':'.$t->reminder_cycle : '';
                            if ($this->notifyWork($user->id, 'due:'.$t->id.':'.$t->due_at.$cycle, 'Công việc Zalo Team đã đến hạn', $source->account_id, $source->conversation_id, $t->id)) {
                                $sent++;
                            }
                            DB::table('zt_crm_tasks')->where('id', $t->id)->update(['reminded_at' => now()]);
                        }
                        if ($t->repeat === 'weekly' && $t->next_repeat_at && CarbonImmutable::parse($t->next_repeat_at)->isPast()) {
                            // Catch up to the next future occurrence, never flood missed weeks.
                            $due = CarbonImmutable::parse($t->next_repeat_at);
                            while ($due->addWeek()->isPast()) {
                                $due = $due->addWeek();
                            }
                            DB::table('zt_crm_tasks')->insertOrIgnore(['workspace_id' => $w->id, 'assignee_id' => $t->assignee_id, 'created_by' => $t->created_by,
                                'title' => $t->title, 'description' => $t->description, 'status' => 'todo', 'due_at' => $due,
                                'source_account_id' => $source->account_id, 'source_conversation_id' => $source->conversation_id, 'project_id' => $t->project_id,
                                'repeat' => 'none', 'next_repeat_at' => null, 'occurrence_key' => 'weekly:'.$t->id.':'.$due->format('Y-m-d'), 'created_at' => now(), 'updated_at' => now()]);
                            DB::table('zt_crm_tasks')->where('id', $t->id)->update(['next_repeat_at' => $due->addWeek(), 'revision' => $t->revision + 1]);
                            DB::table('zt_crm_workspaces')->where('id', $w->id)->increment('revision');
                        }
                    });
                }
            });

        Cache::put('zt-work-reminders:'.ZaloTeamAccess::storageOwner(), true, 150);

        return $sent;
    }
}
