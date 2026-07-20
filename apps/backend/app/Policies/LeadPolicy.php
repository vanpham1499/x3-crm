<?php

namespace App\Policies;

use App\Models\Lead;
use App\Models\User;

class LeadPolicy
{
    public function create(User $user): bool
    {
        return $user->hasPermission('lead.create');
    }

    public function update(User $user, Lead $lead): bool
    {
        if ($user->hasPermission('lead.update_all')) {
            return true;
        }

        return $user->hasPermission('lead.update') && $lead->isAssignedTo($user);
    }

    public function delete(User $user, Lead $lead): bool
    {
        if ($user->hasPermission('lead.delete_all')) {
            return true;
        }

        return $user->hasPermission('lead.delete') && $lead->isAssignedTo($user);
    }
}
