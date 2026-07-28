<?php

namespace App\Policies;

use App\Models\Department;
use App\Models\Meeting;
use App\Models\User;

class MeetingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('meeting.view');
    }

    public function view(User $user, Meeting $meeting): bool
    {
        return $user->hasPermission('meeting.view')
            && (
                $user->hasPermission('meeting.update_all')
                || $user->hasPermission('meeting.delete_all')
                || $this->belongsToScope($user, $meeting)
            );
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('meeting.create');
    }

    public function update(User $user, Meeting $meeting): bool
    {
        if ($user->hasPermission('meeting.update_all')) {
            return true;
        }

        return $user->hasPermission('meeting.update') && $this->belongsToScope($user, $meeting);
    }

    public function delete(User $user, Meeting $meeting): bool
    {
        if ($user->hasPermission('meeting.delete_all')) {
            return true;
        }

        return $user->hasPermission('meeting.delete') && $this->belongsToScope($user, $meeting);
    }

    private function belongsToScope(User $user, Meeting $meeting): bool
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

        $organizerDepartmentId = $meeting->organizer?->department_id;

        return $organizerDepartmentId
            && Department::query()
                ->whereKey($organizerDepartmentId)
                ->where('leader_user_id', $user->id)
                ->exists();
    }
}
