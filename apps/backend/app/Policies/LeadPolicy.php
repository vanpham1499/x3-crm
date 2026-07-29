<?php

namespace App\Policies;

use App\Models\Lead;
use App\Models\User;

class LeadPolicy
{
    public function view(User $user, Lead $lead): bool
    {
        return $this->allows($user, $lead, 'view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('lead.create');
    }

    public function update(User $user, Lead $lead): bool
    {
        return $this->allows($user, $lead, 'update');
    }

    public function delete(User $user, Lead $lead): bool
    {
        return $this->allows($user, $lead, 'delete');
    }

    private function allows(User $user, Lead $lead, string $action): bool
    {
        if ($user->hasPermission("lead.{$action}_all")) {
            return true;
        }

        if ($user->hasPermission("lead.{$action}_department") && $lead->isInDepartmentOf($user)) {
            return true;
        }

        return $user->hasPermission("lead.{$action}") && $lead->isAssignedTo($user);
    }
}
