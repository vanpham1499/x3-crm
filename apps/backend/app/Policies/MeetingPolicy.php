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
        if (! $user->department_id) {
            return false;
        }

        $departmentId = $user->department_id;

        return Meeting::query()
            ->whereKey($meeting->id)
            ->where(function (Builder $query) use ($departmentId): void {
                $query
                    ->whereHas('organizer', fn (Builder $organizer) => $organizer->where('department_id', $departmentId))
                    ->orWhereHas('participants', fn (Builder $participants) => $participants->where('users.department_id', $departmentId))
                    ->orWhereHas('lead.assignedUser', fn (Builder $assigned) => $assigned->where('department_id', $departmentId))
                    ->orWhereHas('customer.salesUser', fn (Builder $sales) => $sales->where('department_id', $departmentId))
                    ->orWhereHas('project.managerUser', fn (Builder $manager) => $manager->where('department_id', $departmentId))
                    ->orWhereHas('project.salesUser', fn (Builder $sales) => $sales->where('department_id', $departmentId))
                    ->orWhereHas('createdBy', fn (Builder $creator) => $creator->where('department_id', $departmentId));
            })
            ->exists();
    }
}
