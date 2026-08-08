<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\User;

class ProjectCostPolicy
{
    public function view(User $user, ProjectCost $cost): bool
    {
        $project = $cost->project;

        if ($user->hasPermission('cost.view_all')) {
            return true;
        }

        if (
            $project
            && $user->hasPermission('cost.view_department')
            && $project->isInDepartmentOf($user)
        ) {
            return true;
        }

        if (
            $user->hasPermission('cost.view')
            && ($cost->created_by === $user->id
                || ($project && ($project->isManagedBy($user) || $project->isAssignedTo($user))))
        ) {
            return true;
        }

        // Project Finance is an embedded view. A user who may view the Project may
        // read its costs without receiving access to the centralized Costs page.
        return $project ? $user->can('view', $project) : false;
    }

    public function manage(User $user, ProjectCost $cost): bool
    {
        $project = $cost->project;

        return $project ? $this->canManageProject($user, $project) : false;
    }

    public function manageProject(User $user, Project $project): bool
    {
        return $this->canManageProject($user, $project);
    }

    public function fund(User $user, ProjectCost $cost): bool
    {
        $project = $cost->project;

        return $project ? $this->canFundProject($user, $project) : false;
    }

    public function fundProject(User $user, Project $project): bool
    {
        return $this->canFundProject($user, $project);
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

    private function canFundProject(User $user, Project $project): bool
    {
        if ($user->hasPermission('cost.fund_all')) {
            return true;
        }

        if (
            $user->hasPermission('cost.fund_department')
            && $project->isInDepartmentOf($user)
        ) {
            return true;
        }

        return $user->hasPermission('cost.fund')
            && ($project->isManagedBy($user) || $project->isAssignedTo($user));
    }
}
