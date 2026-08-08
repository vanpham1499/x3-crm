<?php

namespace App\Services;

use App\Models\P2Point;
use App\Models\ProjectCost;
use App\Models\User;
use App\Models\WeeklyReport;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

class NotificationRecipientResolver
{
    /** @return Collection<int, User> */
    public function authorizedUsers(iterable $userIds, string $ability, mixed $target): Collection
    {
        return $this->activeUsers($userIds)
            ->filter(fn (User $user) => Gate::forUser($user)->allows($ability, $target))
            ->values();
    }

    /** @return Collection<int, User> */
    public function usersWithPermission(iterable $userIds, string $permissionCode): Collection
    {
        return $this->activeUsers($userIds)
            ->filter(fn (User $user) => $user->hasPermission($permissionCode))
            ->values();
    }

    /** @return Collection<int, User> */
    public function weeklyReportApprovers(WeeklyReport $report): Collection
    {
        return $this->usersWithAnyPermission([
            'weeklyreport.approve',
            'weeklyreport.approve_department',
            'weeklyreport.approve_all',
        ])->filter(fn (User $user) => Gate::forUser($user)->allows('approve', $report))->values();
    }

    /** @return Collection<int, User> */
    public function projectCostApprovers(ProjectCost $cost): Collection
    {
        return $this->usersWithAnyPermission([
            'cost.approve',
            'cost.approve_department',
            'cost.approve_all',
        ])->filter(fn (User $user) => Gate::forUser($user)->allows('approve', $cost))->values();
    }

    /** @return Collection<int, User> */
    public function projectCostFunders(ProjectCost $cost): Collection
    {
        return $this->usersWithAnyPermission([
            'cost.fund',
            'cost.fund_department',
            'cost.fund_all',
        ])->filter(fn (User $user) => Gate::forUser($user)->allows('fund', $cost))->values();
    }

    /** @return Collection<int, User> */
    public function paymentManagers(): Collection
    {
        return $this->usersWithAnyPermission(['payment.manage']);
    }

    /** @return Collection<int, User> */
    public function p2PointApprovers(P2Point $point): Collection
    {
        return $this->usersWithAnyPermission([
            'p2point.approve',
            'p2point.approve_department',
            'p2point.approve_all',
        ])->filter(fn (User $user) => Gate::forUser($user)->allows('approve', $point))->values();
    }

    /** @return Collection<int, User> */
    private function usersWithAnyPermission(array $permissionCodes): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->whereHas('roleRef.permissions', fn ($query) => $query->whereIn('permissions.code', $permissionCodes))
            ->with('roleRef.permissions')
            ->get();
    }

    /** @return Collection<int, User> */
    private function activeUsers(iterable $userIds): Collection
    {
        $ids = collect($userIds)
            ->map(fn ($id) => $id instanceof User ? $id->id : $id)
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return User::query()
            ->whereIn('id', $ids)
            ->where('is_active', true)
            ->get();
    }
}
