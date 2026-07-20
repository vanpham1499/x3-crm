<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WeeklyReport;

class WeeklyReportPolicy
{
    public function create(User $user): bool
    {
        return $user->hasPermission('weeklyreport.create');
    }

    public function approve(User $user, WeeklyReport $report): bool
    {
        if ($user->hasPermission('weeklyreport.approve_all')) {
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
}
