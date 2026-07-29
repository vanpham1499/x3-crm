<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function view(User $user, Project $project): bool
    {
        return $this->allows($user, $project, 'view');
    }

    public function update(User $user, Project $project): bool
    {
        return $this->allows($user, $project, 'update');
    }

    public function delete(User $user, Project $project): bool
    {
        return $this->allows($user, $project, 'delete');
    }

    /**
     * Customer selection follows the Project data scope, independently from access to
     * the Customer management page.
     */
    public function create(User $user, ?Customer $customer): bool
    {
        return $user->hasPermission('project.create')
            && $customer !== null
            && $this->canUseCustomer($user, $customer);
    }

    public function useCustomer(User $user, Customer $customer): bool
    {
        return $this->canUseCustomer($user, $customer);
    }

    private function allows(User $user, Project $project, string $action): bool
    {
        if ($user->hasPermission("project.{$action}_all")) {
            return true;
        }

        if ($user->hasPermission("project.{$action}_department") && $project->isInDepartmentOf($user)) {
            return true;
        }

        return $user->hasPermission("project.{$action}")
            && ($project->isManagedBy($user) || $project->isAssignedTo($user));
    }

    private function canUseCustomer(User $user, Customer $customer): bool
    {
        if ($user->hasPermission('project.view_all') || $user->hasPermission('project.update_all')) {
            return true;
        }

        if (
            ($user->hasPermission('project.view_department')
                || $user->hasPermission('project.update_department'))
            && $customer->isInDepartmentOf($user)
        ) {
            return true;
        }

        return $customer->isAssignedTo($user);
    }
}
