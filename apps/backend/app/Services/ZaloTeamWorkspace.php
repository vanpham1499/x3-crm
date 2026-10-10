<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Lead;
use App\Models\Project;
use App\Models\User;
use App\Policies\CustomerPolicy;
use App\Policies\LeadPolicy;
use App\Policies\ProjectPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/** CRM-owned work metadata; all native identities are verified by the connector. */
class ZaloTeamWorkspace
{
    use ZaloTeamCollaboration;

    private array $verifiedNames = [];

    public const STATES = ['needs_action', 'in_progress', 'waiting_customer', 'resolved'];

    public function __construct(private ZaloTeamCatalog $catalog) {}

    private function account(User $user, int $account): object
    {
        ZaloTeamAccess::allow($user, $account);

        return DB::table('zt_access_accounts')->where('account_id', $account)->firstOrFail();
    }

    private function sourceId(object $account, string $peer): string
    {
        return hash('sha256', ZaloTeamAccess::storageOwner().':'.$account->external_id.':'.$peer);
    }

    private function source(User $user, int $account, string $peer): ?object
    {
        $a = $this->account($user, $account);

        return DB::table('zt_crm_workspace_sources')->where('id', $this->sourceId($a, $peer))->first();
    }

    private function validGlobalId(string $id): bool
    {
        return (bool) preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $id) && ! in_array($id, ['0', 'null', 'undefined'], true);
    }

    /** Resolve from server data, never from a global ID/name supplied by the browser. */
    private function resolve(User $user, int $account, string $peer): string
    {
        $a = $this->account($user, $account);
        $data = $this->catalog->command($user, ['action' => 'conversations', 'accountId' => $account]);
        // The inbox projection omits externalId; identity comes from the status snapshot.
        $status = $this->catalog->command($user, ['action' => 'status', 'accountId' => $account]);
        $nativeAccount = collect($status['accounts'] ?? [])->first(fn ($r) => (int) $r['id'] === $account);
        abort_unless($nativeAccount && (string) ($nativeAccount['externalId'] ?? '') === (string) $a->external_id, 409, 'Danh tính tài khoản đã thay đổi. Kiểm tra liên kết tài khoản.');
        $row = collect($data['conversations'] ?? [])->first(fn ($r) => (int) $r['accountId'] === $account && (string) $r['conversationId'] === $peer);
        abort_unless($row, 409, 'Chưa xác minh được hội thoại từ Zalo. Mở hội thoại rồi thử lại.');
        $this->verifiedNames[$account.':'.$peer] = mb_substr((string) ($row['name'] ?? $peer), 0, 240);
        $group = str_starts_with($peer, 'g');
        $global = (string) ($row['globalGroupId'] ?? '');
        abort_if($group && ! $this->validGlobalId($global), 409, 'Nhóm chưa có định danh chung được xác minh. Chưa thể phân công để tránh tạo hai hồ sơ.');
        abort_if($group && collect($data['conversations'])->filter(fn ($r) => (int) $r['accountId'] === $account && (string) ($r['globalGroupId'] ?? '') === $global)->count() !== 1,
            409, 'Định danh nhóm đang trùng trong cùng tài khoản. Cần kiểm tra trước khi phân công.');
        $owner = ZaloTeamAccess::storageOwner();
        $id = hash('sha256', $owner.':'.($group ? 'group:'.$global : 'peer:'.$a->external_id.':'.$peer));

        return $id;
    }

    private function canManage(User $user, int $account): bool
    {
        $ids = ZaloTeamAccess::ids($user, 'manage');

        return $ids === null || in_array($account, $ids, true);
    }

    private function canWrite(User $user, int $account): bool
    {
        $ids = ZaloTeamAccess::ids($user, 'write');

        return $ids === null || in_array($account, $ids, true);
    }

    /** Fresh DB eligibility, including revoked grants, moved/deleted users and deleted teams. */
    private function operators(int $account)
    {
        $a = DB::table('zt_access_accounts')->where('account_id', $account)->firstOrFail();
        $team = $a->department_id ? DB::table('departments')->where('id', $a->department_id)->whereNull('deleted_at')->first() : null;

        return User::where('is_active', true)->where(function ($q) use ($account, $team) {
            $q->where('role', User::ROLE_ADMIN);
            if ($team) {
                $q->orWhere('id', $team->leader_user_id)->orWhereExists(function ($g) use ($account) {
                    $g->selectRaw('1')->from('zt_access_grants as g')->whereColumn('g.user_id', 'users.id')
                        ->where('g.account_id', $account)->where('g.level', 'operate')
                        ->whereColumn('g.department_at_grant', 'users.department_id');
                });
            }
        });
    }

    private function assignee(object $work): ?User
    {
        if (! $work->assignee_id) {
            return null;
        }
        $accounts = DB::table('zt_crm_workspace_sources as s')->join('zt_access_accounts as a', function ($j) {
            $j->on('a.account_id', '=', 's.account_id')->on('a.external_id', '=', 's.external_id');
        })->where('s.workspace_id', $work->id)->pluck('a.account_id');
        foreach ($accounts as $account) {
            $person = $this->operators((int) $account)->where('id', $work->assignee_id)->first(['id', 'name', 'department_id']);
            if ($person) {
                return $person;
            }
        }

        return null;
    }

    public function read(User $user, int $account, string $peer, ?int $taskId = null): array
    {
        $source = $this->source($user, $account, $peer);
        // Read never creates rows. Unopened aliases are resolved from the verified catalog.
        $id = $source?->workspace_id ?? $this->resolve($user, $account, $peer);
        $work = DB::table('zt_crm_workspaces')->where('id', $id)->where('owner', ZaloTeamAccess::storageOwner())->first();
        $assignee = $work ? $this->assignee($work) : null;
        $manage = $this->canManage($user, $account);
        $write = $this->canWrite($user, $account);
        $links = $work ? DB::table('zt_crm_workspace_links')->where('workspace_id', $work->id)->get() : collect();
        $visibleLinks = [];
        foreach ($links as $link) {
            $entity = $this->entity($link->kind, $link->entity_id);
            if ($entity && $this->allowed($user, $link->kind, $entity)) {
                $visibleLinks[] = $this->project($link->kind, $entity);
            }
        }
        $candidates = $manage ? $this->operators($account)
            ->when(! $user->isAdmin(), fn ($q) => $q->where('department_id', $this->account($user, $account)->department_id))
            ->orderBy('name')->get(['id', 'name'])->all() : [];
        $events = $work ? DB::table('zt_crm_workspace_events as e')->leftJoin('users as u', 'u.id', '=', 'e.actor_id')
            ->where('workspace_id', $work->id)->orderByDesc('e.id')->limit(20)->get(['e.id', 'e.action', 'e.detail', 'e.created_at', 'u.name as actor']) : collect();

        $collaboration = $this->collaboration($user, $account, $id, $taskId);
        $taskCandidates = $manage ? $candidates : $collaboration['colleagues']->filter(fn ($p) => (int) $assignee?->id === (int) $user->id || (int) $p->id === (int) $user->id)->values();

        return $collaboration + ['taskCandidates' => $write ? $taskCandidates : [], 'revision' => (int) ($work->revision ?? 0), 'state' => $work->state ?? 'needs_action',
            'assignee' => $assignee ? ['id' => $assignee->id, 'name' => $assignee->name] : null,
            'assignmentUnavailable' => (bool) ($work?->assignee_id && ! $assignee),
            'canManage' => $manage, 'canClaim' => $write && ! $assignee,
            'canEdit' => $write && ($manage || (int) $assignee?->id === (int) $user->id),
            'candidates' => $candidates, 'links' => $visibleLinks, 'restrictedLinks' => count($visibleLinks) < $links->count(),
            'events' => $events->map(fn ($e) => ['id' => $e->id, 'action' => $e->action, 'actor' => $e->actor ?? 'Nhân sự đã ngừng hoạt động', 'at' => CarbonImmutable::parse($e->created_at, config('app.timezone'))->toIso8601String(),
                // Never expose linked CRM IDs or old hidden profiles through audit payloads.
                'state' => $e->action === 'state' ? (json_decode($e->detail, true)['state'] ?? null) : null,
                'assignee' => in_array($e->action, ['claim', 'assign'], true) ? (json_decode($e->detail, true)['toName'] ?? null) : null])];
    }

    public function mutate(User $user, array $v): array
    {
        $account = $v['accountId'];
        $peer = $v['conversationId'];
        ZaloTeamAccess::allow($user, $account, 'write');
        $a = $this->account($user, $account);
        $id = $this->resolve($user, $account, $peer);
        if ($v['kind'] === 'task_create' && ! empty($v['sourceMessageId'])) {
            $messages = $this->catalog->command($user, ['action' => 'messages', 'accountId' => $account, 'conversationId' => $peer]
                + (! empty($v['sourceTime']) ? ['before' => ['id' => $v['sourceMessageId'], 'time' => (string) ($v['sourceTime'] + 1)]] : []));
            $message = collect($messages['messages'] ?? [])->first(fn ($m) => (string) ($m['id'] ?? '') === $v['sourceMessageId']);
            abort_unless($message, 422, 'Chưa xác minh được tin nguồn trong lịch sử hiện tại. Mở lại tin hoặc tạo việc trực tiếp trong Công việc.');
            $v['sourceMessageTime'] = (int) ($message['time'] ?? 0);
        }
        DB::transaction(function () use ($user, $v, $account, $peer, $a, $id) {
            $current = DB::table('zt_access_accounts')->where('account_id', $account)->lockForUpdate()->firstOrFail();
            abort_unless((string) $current->external_id === (string) $a->external_id, 409, 'Tài khoản vừa thay đổi. Tải lại trước khi lưu.');
            ZaloTeamAccess::allow($user, $account, 'write');
            DB::table('zt_crm_workspaces')->insertOrIgnore(['id' => $id, 'owner' => ZaloTeamAccess::storageOwner(), 'state' => 'needs_action', 'revision' => 0, 'created_at' => now(), 'updated_at' => now()]);
            $work = DB::table('zt_crm_workspaces')->where('id', $id)->where('owner', ZaloTeamAccess::storageOwner())->lockForUpdate()->firstOrFail();
            $sid = $this->sourceId($a, $peer);
            DB::table('zt_crm_workspace_sources')->insertOrIgnore(['id' => $sid, 'workspace_id' => $id, 'account_id' => $account, 'external_id' => $a->external_id, 'conversation_id' => $peer, 'created_at' => now(), 'updated_at' => now()]);
            abort_unless(DB::table('zt_crm_workspace_sources')->where('id', $sid)->value('workspace_id') === $id, 409, 'Định danh hội thoại thay đổi. Cần quản trị kiểm tra trước khi cập nhật.');
            DB::table('zt_crm_workspace_sources')->where('id', $sid)->update(['account_id' => $account, 'conversation_name' => $this->verifiedNames[$account.':'.$peer] ?? null, 'updated_at' => now()]);
            abort_unless((int) $work->revision === $v['revision'], 409, 'Hội thoại vừa được cập nhật. Tải lại trước khi lưu.');
            $manage = $this->canManage($user, $account);
            $assignee = $this->assignee($work);
            $update = [];
            $detail = [];
            switch ($v['kind']) {
                case 'note':
                case 'task_create':
                case 'task_edit':
                case 'task_status':
                    $detail = $this->collaborateMutation($user, $v, $work, $manage);
                    break;
                case 'claim':
                    abort_if($assignee, 409, 'Hội thoại đã có người phụ trách.');
                    $update['assignee_id'] = $user->id;
                    $detail = ['from' => $work->assignee_id, 'to' => $user->id, 'toName' => $user->name];
                    break;
                case 'assign':
                    abort_unless($manage, 403, 'Chỉ người quản lý được bàn giao hội thoại.');
                    $person = isset($v['assigneeId']) ? $this->operators($account)->where('id', $v['assigneeId'])->first() : null;
                    abort_if(isset($v['assigneeId']) && ! $person, 422, 'Nhân sự phải còn hoạt động và có quyền sử dụng tài khoản này.');
                    abort_if($person && ! $user->isAdmin() && (int) $person->department_id !== (int) $this->account($user, $account)->department_id, 403, 'Chỉ được giao cho nhân sự trong đội quản lý.');
                    $update['assignee_id'] = $person?->id;
                    $detail = ['from' => $work->assignee_id, 'to' => $person?->id, 'toName' => $person?->name];
                    break;
                default:
                    abort_unless($manage || (int) $assignee?->id === (int) $user->id, 403, 'Nhận phụ trách hoặc nhờ người quản lý cập nhật hội thoại.');
                    if ($v['kind'] === 'state') {
                        abort_unless(in_array($v['state'], self::STATES, true), 422);
                        $update['state'] = $v['state'];
                        $detail = ['from' => $work->state, 'state' => $v['state']];
                    } else {
                        $entity = $this->entity($v['entityKind'], $v['entityId']);
                        abort_unless($entity && $this->allowed($user, $v['entityKind'], $entity), 404, 'Hồ sơ không tồn tại hoặc bạn không có quyền xem.');
                        $where = ['workspace_id' => $id, 'kind' => $v['entityKind'], 'entity_id' => $v['entityId']];
                        if ($v['kind'] === 'unlink') {
                            DB::table('zt_crm_workspace_links')->where($where)->delete();
                        } else {
                            $links = DB::table('zt_crm_workspace_links')->where('workspace_id', $id)->get();
                            $profiles = $links->whereIn('kind', ['customer', 'lead']);
                            if (in_array($v['entityKind'], ['customer', 'lead'], true)) {
                                abort_if($profiles->contains(fn ($l) => $l->kind !== $v['entityKind'] || (int) $l->entity_id !== $v['entityId']), 422, 'Gỡ hồ sơ hiện tại trước khi liên kết khách hàng/lead khác.');
                                if ($v['entityKind'] === 'lead') {
                                    abort_if($links->where('kind', 'project')->isNotEmpty(), 422, 'Gỡ dự án trước khi liên kết lead.');
                                }
                                if ($v['entityKind'] === 'customer') {
                                    foreach ($links->where('kind', 'project') as $l) {
                                        abort_unless((int) Project::find($l->entity_id)?->customer_id === $v['entityId'], 422, 'Các dự án đã liên kết phải thuộc cùng khách hàng.');
                                    }
                                }
                            } else {
                                abort_if($profiles->where('kind', 'lead')->isNotEmpty(), 422, 'Liên kết khách hàng thay cho lead trước khi thêm dự án.');
                                $customer = $profiles->firstWhere('kind', 'customer');
                                abort_if($customer && (int) $customer->entity_id !== (int) $entity->customer_id, 422, 'Dự án không thuộc khách hàng đang liên kết.');
                                foreach ($links->where('kind', 'project') as $linkedProject) {
                                    abort_unless(
                                        (int) Project::find($linkedProject->entity_id)?->customer_id === (int) $entity->customer_id,
                                        422, 'Các dự án trong hội thoại phải thuộc cùng khách hàng.');
                                }
                                abort_if($links->where('kind', 'project')->count() >= 20 && ! $links->contains(fn ($l) => $l->kind === 'project' && (int) $l->entity_id === $v['entityId']), 422, 'Tối đa 20 dự án trong một hội thoại.');
                            }
                            DB::table('zt_crm_workspace_links')->insertOrIgnore($where + ['created_by' => $user->id, 'created_at' => now()]);
                        }
                        $detail = ['kind' => $v['entityKind'], 'id' => $v['entityId']];
                    }
            }
            DB::table('zt_crm_workspaces')->where('id', $id)->update($update + ['revision' => $work->revision + 1, 'updated_at' => now()]);
            DB::table('zt_crm_workspace_events')->insert(['workspace_id' => $id, 'actor_id' => $user->id, 'action' => $v['kind'], 'detail' => json_encode($detail), 'created_at' => now()]);
        });

        return $this->read($user, $account, $peer);
    }

    private function entity(string $kind, int $id)
    {
        return match ($kind) {
            'customer' => Customer::find($id),'lead' => Lead::find($id),'project' => Project::find($id),default => null
        };
    }

    private function allowed(User $user, string $kind, $entity): bool
    {
        return match ($kind) {
            'customer' => (new CustomerPolicy)->view($user, $entity),'lead' => (new LeadPolicy)->view($user, $entity),'project' => (new ProjectPolicy)->view($user, $entity),default => false
        };
    }

    private function project(string $kind, $e): array
    {
        $result = ['kind' => $kind, 'id' => $e->id, 'name' => $e->customer_name ?? $e->project_name, 'code' => $e->customer_code ?? $e->lead_code ?? $e->project_code];
        if ($kind === 'project') {
            $result += ['service' => $e->service?->service_name ?? $e->service?->name,
                'status' => $e->statusOption?->label, 'sales' => $e->salesUser?->name, 'manager' => $e->managerUser?->name,
                'startDate' => $e->start_date?->format('Y-m-d'), 'endDate' => $e->end_date?->format('Y-m-d')];
        } else {
            $result['sales'] = $kind === 'customer' ? $e->salesUser?->name : $e->assignedUser?->name;
        }

        return $result;
    }

    public function lookup(User $user, int $account, string $kind, string $search, int $page, ?int $customerId = null): array
    {
        $this->account($user, $account);
        $class = ['customer' => Customer::class, 'lead' => Lead::class, 'project' => Project::class][$kind];
        $q = $class::query();
        if ($kind === 'project' && $customerId !== null) {
            $q->where('customer_id', $customerId);
        }
        $field = $kind === 'lead' ? 'assigned_user_id' : 'sales_user_id';
        $relation = $kind === 'lead' ? 'assignedUser' : 'salesUser';
        if (! $user->hasPermission($kind.'.view_all')) {
            $q->where(function ($q) use ($user, $kind, $field, $relation) {
                $q->whereRaw('1=0');
                if ($user->hasPermission($kind.'.view')) {
                    $q->orWhere(function ($own) use ($user, $kind, $field) {
                        $own->where($field, $user->id);
                        if ($kind === 'project') {
                            $own->orWhere('manager_user_id', $user->id);
                        }
                    });
                }
                if ($user->hasPermission($kind.'.view_department')) {
                    $q->orWhere(function ($team) use ($user, $kind, $relation) {
                        $team->whereHas($relation, fn ($person) => $person->whereIn('department_id', $user->accessibleDepartmentIds()));
                        if ($kind === 'project') {
                            $team->orWhereHas('managerUser', fn ($person) => $person->whereIn('department_id', $user->accessibleDepartmentIds()));
                        }
                    });
                }
            });
        }
        $name = $kind === 'project' ? 'project_name' : 'customer_name';
        $code = $kind === 'project' ? 'project_code' : ($kind === 'customer' ? 'customer_code' : 'lead_code');
        $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower(trim($search))).'%';
        $q->where(fn ($q) => $q->whereRaw("LOWER($name) LIKE ? ESCAPE '!'", [$pattern])->orWhereRaw("LOWER($code) LIKE ? ESCAPE '!'", [$pattern]));
        $items = $q->with($kind === 'project' ? ['service', 'statusOption', 'salesUser', 'managerUser'] : [$relation])->orderBy('id')->offset($page * 20)->limit(21)->get();

        return ['items' => $items->take(20)->filter(fn ($e) => $this->allowed($user, $kind, $e))->map(fn ($e) => $this->project($kind, $e))->values(), 'hasMore' => $items->count() > 20];
    }

    public function summaries(User $user): array
    {
        $ids = ZaloTeamAccess::ids($user);
        $owner = ZaloTeamAccess::storageOwner();
        // A single verified catalog maps as-yet-unopened copies of the same group.
        $catalog = $this->catalog->command($user, ['action' => 'conversations']);
        $status = $this->catalog->command($user, ['action' => 'status']);
        $accounts = DB::table('zt_access_accounts')->when($ids !== null, fn ($q) => $q->whereIn('account_id', $ids))->get()->keyBy('account_id');
        $nativeAccounts = collect($status['accounts'] ?? [])->keyBy('id');
        $groupCounts = [];
        foreach ($catalog['conversations'] ?? [] as $c) {
            if (str_starts_with((string) $c['conversationId'], 'g')) {
                $key = $c['accountId'].':'.($c['globalGroupId'] ?? '');
                $groupCounts[$key] = ($groupCounts[$key] ?? 0) + 1;
            }
        }
        $references = [];
        foreach ($catalog['conversations'] ?? [] as $c) {
            $a = $accounts->get($c['accountId']);
            if (! $a || (string) ($nativeAccounts->get($a->account_id)['externalId'] ?? '') !== (string) $a->external_id) {
                continue;
            }
            $peer = (string) $c['conversationId'];
            $global = (string) ($c['globalGroupId'] ?? '');
            if (str_starts_with($peer, 'g') && (! $this->validGlobalId($global) || ($groupCounts[$a->account_id.':'.$global] ?? 0) !== 1)) {
                continue;
            }
            $id = hash('sha256', $owner.':'.(str_starts_with($peer, 'g') ? 'group:'.$global : 'peer:'.$a->external_id.':'.$peer));
            $references[$a->account_id.':'.$peer] = ['accountId' => (int) $a->account_id, 'conversationId' => $peer, 'id' => $id];
        }
        $rows = DB::table('zt_crm_workspace_sources as s')->join('zt_crm_workspaces as w', 'w.id', '=', 's.workspace_id')
            ->join('zt_access_accounts as a', fn ($j) => $j->on('a.account_id', '=', 's.account_id')->on('a.external_id', '=', 's.external_id'))
            ->where('w.owner', ZaloTeamAccess::storageOwner())->when($ids !== null, fn ($q) => $q->whereIn('s.account_id', $ids))
            ->get(['s.account_id', 's.conversation_id', 'w.id', 'w.assignee_id', 'w.state']);
        $works = $rows->keyBy('id');
        foreach ($rows as $r) {
            $references[$r->account_id.':'.$r->conversation_id] ??= ['accountId' => (int) $r->account_id, 'conversationId' => $r->conversation_id, 'id' => $r->id];
        }
        foreach (array_chunk(array_unique(array_column($references, 'id')), 500) as $chunk) {
            foreach (DB::table('zt_crm_workspaces')->where('owner', $owner)->whereIn('id', $chunk)->get() as $w) {
                $works[$w->id] = $w;
            }
        }
        // Eligibility once per account, not once per conversation.
        $eligible = [];
        $sources = DB::table('zt_crm_workspace_sources as s')->join('zt_access_accounts as a', fn ($j) => $j->on('a.account_id', '=', 's.account_id')->on('a.external_id', '=', 's.external_id'))
            ->join('zt_crm_workspaces as w', 'w.id', '=', 's.workspace_id')->where('w.owner', $owner)->get(['s.workspace_id', 's.account_id']);
        $byWork = $sources->groupBy('workspace_id');
        foreach ($sources->pluck('account_id')->unique() as $aid) {
            $eligible[$aid] = $this->operators((int) $aid)->get(['id', 'name'])->keyBy('id');
        }
        $items = [];
        foreach ($references as $ref) {
            $w = $works->get($ref['id']);
            $person = null;
            if ($w?->assignee_id) {
                foreach ($byWork->get($w->id, collect()) as $s) {
                    $person = $eligible[$s->account_id]->get($w->assignee_id);
                    if ($person) {
                        break;
                    }
                }
            }
            $items[] = ['accountId' => $ref['accountId'], 'conversationId' => $ref['conversationId'], 'state' => $w->state ?? 'needs_action',
                'assigneeId' => $person?->id, 'assigneeName' => $person?->name];
        }

        return ['items' => $items, 'userId' => $user->id, 'canManage' => ZaloTeamAccess::ids($user, 'manage') === null || count(ZaloTeamAccess::ids($user, 'manage')) > 0];
    }
}
