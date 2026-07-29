<?php

namespace App\Policies;

use App\Models\P2Point;
use App\Models\Project;
use App\Models\User;

class P2PointPolicy
{
    public function view(User $user, P2Point $point): bool
    {
        if ($user->hasPermission('p2point.view_all')) {
            return true;
        }

        if (
            $user->hasPermission('p2point.view_department')
            && $user->sharesDepartmentWith($point->user)
        ) {
            return true;
        }

        return $user->hasPermission('p2point.view') && $point->user_id === $user->id;
    }

    /**
     * Only a project manager may log a P2 point against their own project; without a
     * project (project_id left blank) there is no defined "manager" scope, so it requires
     * the elevated create_all permission.
     */
    public function create(User $user, ?int $projectId = null, ?int $pointUserId = null): bool
    {
        if ($user->hasPermission('p2point.create_all')) {
            return true;
        }

        if ($user->hasPermission('p2point.create_department') && $pointUserId) {
            $pointUser = User::query()->find($pointUserId);

            if ($user->sharesDepartmentWith($pointUser)) {
                if (! $projectId) {
                    return true;
                }

                $project = Project::query()->find($projectId);

                return $project !== null && $project->isInDepartmentOf($user);
            }
        }

        if (! $projectId || ! $user->hasPermission('p2point.create')) {
            return false;
        }

        $project = Project::query()->find($projectId);

        return $project !== null && $project->isManagedBy($user);
    }

    public function update(User $user, P2Point $point): bool
    {
        return $this->allowsMutation($user, $point, 'update');
    }

    public function delete(User $user, P2Point $point): bool
    {
        return $this->allowsMutation($user, $point, 'delete');
    }

    public function approve(User $user, P2Point $point): bool
    {
        if ($user->hasPermission('p2point.approve_all')) {
            return true;
        }

        if (
            $user->hasPermission('p2point.approve_department')
            && $user->sharesDepartmentWith($point->user)
        ) {
            return true;
        }

        if (! $user->hasPermission('p2point.approve')) {
            return false;
        }

        return $point->project !== null && $point->project->isManagedBy($user);
    }

    private function allowsMutation(User $user, P2Point $point, string $action): bool
    {
        if ($user->hasPermission("p2point.{$action}_all")) {
            return true;
        }

        if (
            $user->hasPermission("p2point.{$action}_department")
            && $user->sharesDepartmentWith($point->user)
        ) {
            return true;
        }

        return $user->hasPermission("p2point.{$action}")
            && (
                $point->created_by === $user->id
                || ($point->project?->isManagedBy($user) ?? false)
            );
    }
}
