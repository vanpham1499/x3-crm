<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\User;

class ProjectCostPolicy
{
    public function manage(User $user, ProjectCost $cost): bool
    {
        $project = $cost->project;

        return $project ? $this->canManageProject($user, $project) : false;
    }

    public function manageProject(User $user, Project $project): bool
    {
        return $this->canManageProject($user, $project);
    }

    public function approve(User $user, ProjectCost $cost): bool
    {
        if ($user->hasPermission('cost.approve_all')) {
            return true;
        }

        $project = $cost->project;

        if (! $project) {
            return false;
        }

        if (
            $user->hasPermission('cost.approve_department')
            && $project->isInDepartmentOf($user)
        ) {
            return true;
        }

        return $user->hasPermission('cost.approve')
            && ($project->isManagedBy($user) || $project->isAssignedTo($user));
    }

    private function canManageProject(User $user, Project $project): bool
    {
        if ($user->hasPermission('cost.manage_all')) {
            return true;
        }

        if (
            $user->hasPermission('cost.manage_department')
            && $project->isInDepartmentOf($user)
        ) {
            return true;
        }

        return $user->hasPermission('cost.manage')
            && ($project->isManagedBy($user) || $project->isAssignedTo($user));
    }
}
