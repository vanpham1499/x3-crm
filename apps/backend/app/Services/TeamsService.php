<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Team;
use App\Models\TeamMembership;
use App\Models\User;
use App\Support\TeamScope;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TeamsService extends BaseService
{
    public function listing(bool $lookup = false): array
    {
        $query = Team::with(['department', 'leader', 'users'])->orderBy('name');
        $viewer = $this->currentUser();
        if ($lookup && in_array(request()->query('context'), ['project', 'kpi'], true)) {
            $query->withTrashed()->whereIn('id', TeamScope::available($viewer, request()->query('context')));
        } elseif ($lookup && ! $viewer->hasPermission('team.view') && ! $viewer->hasPermission('kpi.view_all') && ! $viewer->hasPermission('project.view_all')) {
            $query->where(function ($q) use ($viewer): void {
                $q->whereIn('id', $viewer->accessibleTeamIds());
                if ($viewer->hasPermission('kpi.view_department') || $viewer->hasPermission('project.view_department')) {
                    $q->orWhereIn('department_id', $viewer->accessibleDepartmentIds());
                }
            });
        }

        return $query->get()->map(fn ($team) => $this->resource($team))->all();
    }

    public function save(?int $id, array $data): array
    {
        return DB::transaction(function () use ($id, $data): array {
            Department::whereKey($data['departmentId'])->lockForUpdate()->firstOrFail();
            $team = $id ? Team::lockForUpdate()->findOrFail($id) : new Team;
            if ($team->exists && (int) $team->department_id !== (int) $data['departmentId']) {
                throw ValidationException::withMessages(['departmentId' => ['Nhóm đã tạo giữ nguyên phòng ban. Hãy tạo nhóm mới khi tổ chức lại.']]);
            }
            $ids = collect($data['memberUserIds'] ?? [])->map(fn ($id) => (int) $id)->unique()->values();
            $requestedIds = $ids->push((int) $data['leaderUserId'])->filter()->unique();
            $users = User::whereIn('id', $requestedIds)->orderBy('id')->lockForUpdate()->get();
            if ($users->count() !== $requestedIds->count()) {
                throw ValidationException::withMessages(['memberUserIds' => ['Danh sách nhân sự đã thay đổi. Vui lòng tải lại.']]);
            }
            foreach ($users as $user) {
                if (! $user->is_active || (int) $user->department_id !== (int) $data['departmentId']) {
                    throw ValidationException::withMessages(['memberUserIds' => ['Trưởng nhóm và thành viên phải đang hoạt động trong phòng ban đã chọn.']]);
                }
            }
            // Leading a second team does not move the leader's primary membership.
            $leader = $users->firstWhere('id', (int) $data['leaderUserId']);
            $members = collect($data['memberUserIds'] ?? [])->map(fn ($id) => (int) $id);
            if ($leader && (! $leader->team_id || (int) $leader->team_id === (int) $team->id)) {
                $members->push($leader->id);
            }
            foreach ($users as $user) {
                if ($members->contains($user->id) && $user->team_id && (int) $user->team_id !== (int) $team->id && ! ($data['confirmTransfers'] ?? false)) {
                    throw ValidationException::withMessages(['confirmTransfers' => ['Có nhân sự thuộc nhóm khác. Xác nhận chuyển nhóm trước khi lưu.']]);
                }
            }
            $team->fill(['name' => trim($data['name']), 'department_id' => $data['departmentId'], 'leader_user_id' => $data['leaderUserId']]);
            $team->save();
            foreach (User::where('team_id', $team->id)->whereNotIn('id', $members)->orderBy('id')->lockForUpdate()->get() as $removed) {
                $removed->forceFill(['team_id' => null])->save();
            }
            foreach ($users as $user) {
                if ($members->contains($user->id)) {
                    $user->forceFill(['team_id' => $team->id])->save();
                }
            }

            return $this->resource($team->load(['department', 'leader', 'users']));
        }, 3);
    }

    public function remove(int $id): array
    {
        return DB::transaction(function () use ($id): array {
            $team = Team::lockForUpdate()->findOrFail($id);
            if ($team->users()->exists()) {
                throw ValidationException::withMessages(['team' => ['Hãy chuyển thành viên ra khỏi nhóm trước khi xóa.']]);
            }
            $team->delete();

            return ['message' => 'Đã xóa nhóm. Lịch sử KPI được giữ lại.'];
        });
    }

    public function history(int $id): array
    {
        Team::findOrFail($id);

        return TeamMembership::where('team_id', $id)->with('user')->orderByDesc('started_at')->limit(200)->get()->map(fn ($m) => [
            'id' => $m->id, 'userId' => $m->user_id, 'userName' => $m->user?->name, 'userCode' => $m->user?->code,
            'startedAt' => $m->started_at->toIso8601String(), 'endedAt' => $m->ended_at?->toIso8601String(),
        ])->all();
    }

    private function resource(Team $team): array
    {
        $person = fn ($u) => $u ? ['id' => $u->id, 'code' => $u->code, 'name' => $u->name, 'avatar' => $u->avatar, 'teamId' => $u->team_id, 'departmentId' => $u->department_id] : null;

        return ['id' => $team->id, 'name' => $team->name.($team->trashed() ? ' (đã lưu trữ)' : ''), 'departmentId' => $team->department_id,
            'departmentName' => $team->department?->name, 'leaderUserId' => $team->leader_user_id,
            'leader' => $person($team->leader), 'members' => $team->users->map($person)->values()->all(), 'membersCount' => $team->users->count()];
    }
}
