<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function update(User $user, Project $project): bool
    {
        if ($user->hasPermission('project.update_all')) {
            return true;
        }

        return $user->hasPermission('project.update')
            && ($project->isManagedBy($user) || $project->isAssignedTo($user));
    }

    public function delete(User $user, Project $project): bool
    {
        if ($user->hasPermission('project.delete_all')) {
            return true;
        }

        return $user->hasPermission('project.delete')
            && ($project->isManagedBy($user) || $project->isAssignedTo($user));
    }

    /**
     * A project always belongs to a customer; only that customer's owner (or whoever can
     * manage any customer) may create a project under it.
     */
    public function create(User $user, ?Customer $customer): bool
    {
        if (! $user->hasPermission('project.create')) {
            return false;
        }

        if ($user->hasPermission('customer.update_all')) {
            return true;
        }

        return $customer !== null && $customer->isAssignedTo($user);
    }
}
