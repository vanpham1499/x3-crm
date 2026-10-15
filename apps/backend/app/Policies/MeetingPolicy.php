<?php

namespace App\Policies;

use App\Models\Meeting;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class MeetingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('meeting.view');
    }

    public function view(User $user, Meeting $meeting): bool
    {
        return $this->allows($user, $meeting, 'view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('meeting.create');
    }

    public function update(User $user, Meeting $meeting): bool
    {
        return $this->allows($user, $meeting, 'update');
    }

    public function delete(User $user, Meeting $meeting): bool
    {
        return $this->allows($user, $meeting, 'delete');
    }

    private function allows(User $user, Meeting $meeting, string $action): bool
    {
        if ($user->hasPermission("meeting.{$action}_all")) {
            return true;
        }

        if (
            $user->hasPermission("meeting.{$action}_department")
            && $this->belongsToDepartmentScope($user, $meeting)
        ) {
            return true;
        }

        if (
            $user->hasPermission("meeting.{$action}_team")
            && $this->belongsToTeamScope($user, $meeting)
        ) {
            return true;
        }

        return $user->hasPermission("meeting.{$action}")
            && $this->belongsToOwnScope($user, $meeting);
    }

    private function belongsToOwnScope(User $user, Meeting $meeting): bool
    {
        if ($meeting->organizer_user_id === $user->id) {
            return true;
        }

        if ($meeting->created_by === $user->id) {
            return true;
        }

        if ($meeting->participants()->where('users.id', $user->id)->exists()) {
            return true;
        }

        if ($meeting->lead?->assigned_user_id === $user->id) {
            return true;
        }

        if ($meeting->customer?->sales_user_id === $user->id) {
            return true;
        }

        if (
            $meeting->project?->manager_user_id === $user->id
            || $meeting->project?->sales_user_id === $user->id
        ) {
            return true;
        }

        return false;
    }

    private function belongsToDepartmentScope(User $user, Meeting $meeting): bool
    {
        $departmentIds = $user->accessibleDepartmentIds();

        if ($departmentIds === []) {
            return false;
        }

        return Meeting::query()
            ->whereKey($meeting->id)
            ->where(function (Builder $query) use ($departmentIds): void {
                $query
                    ->whereHas('organizer', fn (Builder $organizer) => $organizer->whereIn('department_id', $departmentIds))
                    ->orWhereHas('participants', fn (Builder $participants) => $participants->whereIn('users.department_id', $departmentIds))
                    ->orWhereHas('lead.assignedUser', fn (Builder $assigned) => $assigned->whereIn('department_id', $departmentIds))
                    ->orWhereHas('customer.salesUser', fn (Builder $sales) => $sales->whereIn('department_id', $departmentIds))
                    ->orWhereHas('project.managerUser', fn (Builder $manager) => $manager->whereIn('department_id', $departmentIds))
                    ->orWhereHas('project.salesUser', fn (Builder $sales) => $sales->whereIn('department_id', $departmentIds))
                    ->orWhereHas('createdBy', fn (Builder $creator) => $creator->whereIn('department_id', $departmentIds));
            })
            ->exists();
    }

    private function belongsToTeamScope(User $user, Meeting $meeting): bool
    {
        $teamIds = $user->accessibleTeamIds();

        if ($teamIds === []) {
            return false;
        }

        return Meeting::query()
            ->whereKey($meeting->id)
            ->where(function (Builder $query) use ($teamIds): void {
                $query
                    ->whereHas('organizer', fn (Builder $organizer) => $organizer->whereIn('team_id', $teamIds))
                    ->orWhereHas('participants', fn (Builder $participants) => $participants->whereIn('users.team_id', $teamIds))
                    ->orWhereHas('lead.assignedUser', fn (Builder $assigned) => $assigned->whereIn('team_id', $teamIds))
                    ->orWhereHas('customer.salesUser', fn (Builder $sales) => $sales->whereIn('team_id', $teamIds))
                    ->orWhereHas('project.managerUser', fn (Builder $manager) => $manager->whereIn('team_id', $teamIds))
                    ->orWhereHas('project.salesUser', fn (Builder $sales) => $sales->whereIn('team_id', $teamIds))
                    ->orWhereHas('createdBy', fn (Builder $creator) => $creator->whereIn('team_id', $teamIds));
            })
            ->exists();
    }
}
