<?php

namespace App\Policies;

use App\Models\P2Point;
use App\Models\Project;
use App\Models\User;

class P2PointPolicy
{
    /**
     * Only a project manager may log a P2 point against their own project; without a
     * project (project_id left blank) there is no defined "manager" scope, so it requires
     * the elevated create_all permission.
     */
    public function create(User $user, ?int $projectId = null): bool
    {
        if ($user->hasPermission('p2point.create_all')) {
            return true;
        }

        if (! $projectId || ! $user->hasPermission('p2point.create')) {
            return false;
        }

        $project = Project::query()->find($projectId);

        return $project !== null && $project->isManagedBy($user);
    }

    public function approve(User $user, P2Point $point): bool
    {
        if ($user->hasPermission('p2point.approve_all')) {
            return true;
        }

        if (! $user->hasPermission('p2point.approve')) {
            return false;
        }

        return $point->project !== null && $point->project->isManagedBy($user);
    }
}
