<?php

namespace App\Policies;

use App\Models\KpiPoint;
use App\Models\Project;
use App\Models\User;

class KpiPointPolicy
{
    /**
     * Only a project manager may log a KPI point against their own project; without a
     * project (project_id left blank) there is no defined "manager" scope, so it requires
     * the elevated create_all permission.
     */
    public function create(User $user, ?int $projectId = null): bool
    {
        if ($user->hasPermission('kpipoint.create_all')) {
            return true;
        }

        if (! $projectId || ! $user->hasPermission('kpipoint.create')) {
            return false;
        }

        $project = Project::query()->find($projectId);

        return $project !== null && $project->isManagedBy($user);
    }

    public function approve(User $user, KpiPoint $point): bool
    {
        if ($user->hasPermission('kpipoint.approve_all')) {
            return true;
        }

        if (! $user->hasPermission('kpipoint.approve')) {
            return false;
        }

        return $point->project !== null && $point->project->isManagedBy($user);
    }
}
