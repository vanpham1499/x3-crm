<?php

namespace App\Policies;

use App\Models\ProjectCost;
use App\Models\User;

class ProjectCostPolicy
{
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
}
