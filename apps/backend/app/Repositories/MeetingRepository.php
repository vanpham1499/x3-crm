<?php

namespace App\Repositories;

use App\Models\Department;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class MeetingRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Lịch hẹn không tồn tại';

    protected function model(): string
    {
        return Meeting::class;
    }

    public function findVisible(User $user, array $filters = []): Collection
    {
        return $this->filteredQuery($user, $filters)->get();
    }

    public function paginateVisible(
        User $user,
        array $filters,
        int $perPage,
        int $page,
    ): LengthAwarePaginator {
        return $this->filteredQuery($user, $filters)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function findVisibleOrFail(User $user, string $id): Meeting
    {
        /** @var Meeting|null $meeting */
        $meeting = $this->visibleQuery($user)
            ->with($this->relations())
            ->whereKey($id)
            ->first();

        if (! $meeting) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $meeting;
    }

    public function visibleBaseQuery(User $user): Builder
    {
        return $this->visibleQuery($user);
    }

    public function conflictingMeetings(
        array $userIds,
        string $startsAt,
        string $endsAt,
        ?int $exceptMeetingId = null,
    ): Collection {
        if ($userIds === []) {
            return new Collection;
        }

        return $this->query()
            ->with(['organizer:id,code,name', 'participants:id,code,name'])
            ->whereIn('status', Meeting::ACTIVE_STATUSES)
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->when($exceptMeetingId, fn (Builder $query, int $id) => $query->whereKeyNot($id))
            ->where(function (Builder $query) use ($userIds): void {
                $query
                    ->whereIn('organizer_user_id', $userIds)
                    ->orWhereHas('participants', fn (Builder $participantQuery) => $participantQuery->whereIn('users.id', $userIds));
            })
            ->orderBy('starts_at')
            ->get();
    }

    private function filteredQuery(User $user, array $filters): Builder
    {
        return $this->visibleQuery($user)
            ->with($this->relations())
            ->when($filters['scope'] ?? null, function (Builder $query, string $scope): void {
                $timezone = config('app.timezone', 'Asia/Ho_Chi_Minh');
                $todayStart = now($timezone)->startOfDay()->utc();
                $todayEnd = now($timezone)->addDay()->startOfDay()->utc();
                $now = now('UTC');

                if ($scope === 'today') {
                    $query
                        ->where('starts_at', '<', $todayEnd)
                        ->where('ends_at', '>=', $todayStart)
                        ->where('status', '!=', Meeting::STATUS_CANCELLED);
                } elseif ($scope === 'upcoming') {
                    $query
                        ->where('starts_at', '>=', $now)
                        ->where('starts_at', '<', $now->copy()->addDays(7))
                        ->whereIn('status', Meeting::ACTIVE_STATUSES);
                } elseif ($scope === 'waiting') {
                    $query
                        ->where('starts_at', '>=', $now)
                        ->where('status', Meeting::STATUS_SCHEDULED);
                } elseif ($scope === 'overdue') {
                    $query
                        ->where('ends_at', '<', $now)
                        ->whereIn('status', Meeting::ACTIVE_STATUSES);
                }
            })
            ->when($filters['keyword'] ?? null, function (Builder $query, string $keyword): void {
                $search = '%'.trim($keyword).'%';
                $query->where(function (Builder $nested) use ($search): void {
                    $nested
                        ->where('meeting_code', 'ilike', $search)
                        ->orWhere('subject', 'ilike', $search)
                        ->orWhereHas('lead', fn (Builder $lead) => $lead->where('customer_name', 'ilike', $search))
                        ->orWhereHas('customer', fn (Builder $customer) => $customer
                            ->where('customer_name', 'ilike', $search)
                            ->orWhere('customer_code', 'ilike', $search))
                        ->orWhereHas('project', fn (Builder $project) => $project
                            ->where('project_name', 'ilike', $search)
                            ->orWhere('project_code', 'ilike', $search));
                });
            })
            ->when($filters['organizer_user_id'] ?? null, fn (Builder $query, $value) => $query->where('organizer_user_id', $value))
            ->when($filters['department_id'] ?? null, fn (Builder $query, $value) => $query->whereHas('organizer', fn (Builder $organizer) => $organizer->where('department_id', $value)))
            ->when($filters['meeting_type'] ?? null, fn (Builder $query, $value) => $query->where('meeting_type', $value))
            ->when($filters['status'] ?? null, function (Builder $query, string $status): void {
                if ($status === 'overdue') {
                    $query->whereIn('status', Meeting::ACTIVE_STATUSES)->where('ends_at', '<', now());

                    return;
                }

                $query->where('status', $status);
            })
            ->when($filters['lead_id'] ?? null, fn (Builder $query, $value) => $query->where('lead_id', $value))
            ->when($filters['customer_id'] ?? null, fn (Builder $query, $value) => $query->where('customer_id', $value))
            ->when($filters['project_id'] ?? null, fn (Builder $query, $value) => $query->where('project_id', $value))
            ->when($filters['date_from'] ?? null, fn (Builder $query, $value) => $query->where('ends_at', '>=', $value))
            ->when($filters['date_to'] ?? null, fn (Builder $query, $value) => $query->where('starts_at', '<=', $value))
            ->orderBy('starts_at')
            ->orderBy('id');
    }

    private function visibleQuery(User $user): Builder
    {
        $query = $this->query();

        if ($user->hasPermission('meeting.update_all') || $user->hasPermission('meeting.delete_all')) {
            return $query;
        }

        $ledDepartmentIds = Department::query()
            ->where('leader_user_id', $user->id)
            ->pluck('id');

        return $query->where(function (Builder $visible) use ($user, $ledDepartmentIds): void {
            $visible
                ->where('organizer_user_id', $user->id)
                ->orWhere('created_by', $user->id)
                ->orWhereHas('participants', fn (Builder $participants) => $participants->where('users.id', $user->id))
                ->orWhereHas('lead', fn (Builder $lead) => $lead->where('assigned_user_id', $user->id))
                ->orWhereHas('customer', fn (Builder $customer) => $customer->where('sales_user_id', $user->id))
                ->orWhereHas('project', fn (Builder $project) => $project
                    ->where('manager_user_id', $user->id)
                    ->orWhere('sales_user_id', $user->id));

            if ($ledDepartmentIds->isNotEmpty()) {
                $visible->orWhereHas('organizer', fn (Builder $organizer) => $organizer->whereIn('department_id', $ledDepartmentIds));
            }
        });
    }

    private function relations(): array
    {
        return [
            'lead:id,lead_code,customer_name,assigned_user_id',
            'customer:id,customer_code,customer_name,sales_user_id',
            'project:id,project_code,project_name,customer_id,manager_user_id,sales_user_id',
            'organizer:id,code,name,department_id',
            'organizer.department:id,name',
            'participants:id,code,name,department_id',
            'participants.department:id,name',
            'guests',
            'histories.actor:id,code,name',
            'createdBy:id,code,name',
        ];
    }
}
