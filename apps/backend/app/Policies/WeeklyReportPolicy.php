<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;
use App\Models\WeeklyReport;

class WeeklyReportPolicy
{
    public function view(User $user, WeeklyReport $report): bool
    {
        return $this->allows($user, $report, 'view');
    }

    public function create(User $user, ?Project $project = null): bool
    {
        if (! $user->hasPermission('weeklyreport.create')) {
            return false;
        }

        if (! $project || ! $project->requiresWeeklyReport()) {
            return false;
        }

        if ($user->hasPermission('weeklyreport.view_all')) {
            return true;
        }

        if (
            $user->hasPermission('weeklyreport.view_department')
            && $project->isInDepartmentOf($user)
        ) {
            return true;
        }

        return $project->isManagedBy($user) || $project->isAssignedTo($user);
    }

    public function update(User $user, WeeklyReport $report): bool
    {
        return $this->allows($user, $report, 'update');
    }

    public function delete(User $user, WeeklyReport $report): bool
    {
        return $this->allows($user, $report, 'delete');
    }

    public function comment(User $user, WeeklyReport $report): bool
    {
        return $this->view($user, $report);
    }

    public function approve(User $user, WeeklyReport $report): bool
    {
        if ($user->hasPermission('weeklyreport.approve_all')) {
            return true;
        }

        if (
            $user->hasPermission('weeklyreport.approve_department')
            && $report->reporter_user_id !== $user->id
            && $this->belongsToDepartmentScope($user, $report)
        ) {
            return true;
        }

        if (! $user->hasPermission('weeklyreport.approve')) {
            return false;
        }

        $project = $report->project;

        if (! $project || ! $project->isManagedBy($user)) {
            return false;
        }

        // A project manager reporting on their own project cannot self-approve.
        return $report->reporter_user_id !== $project->manager_user_id;
    }

    private function allows(User $user, WeeklyReport $report, string $action): bool
    {
        if ($user->hasPermission("weeklyreport.{$action}_all")) {
            return true;
        }

        if (
            $user->hasPermission("weeklyreport.{$action}_department")
            && $this->belongsToDepartmentScope($user, $report)
        ) {
            return true;
        }

        return $user->hasPermission("weeklyreport.{$action}")
            && (
                $report->reporter_user_id === $user->id
                || $report->project?->isManagedBy($user)
                || $report->project?->isAssignedTo($user)
            );
    }

    private function belongsToDepartmentScope(User $user, WeeklyReport $report): bool
    {
        if ($user->accessibleDepartmentIds() === []) {
            return false;
        }

        return $user->sharesDepartmentWith($report->reporter)
            || ($report->project?->isInDepartmentOf($user) ?? false);
    }
}
