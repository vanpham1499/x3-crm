<?php

namespace App\Repositories;

use App\Models\User;
use App\Models\WeeklyReport;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class WeeklyReportRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Báo cáo tuần không tồn tại';

    protected function model(): string
    {
        return WeeklyReport::class;
    }

    public function findAll(User $user, array $filters = []): Collection
    {
        return $this->filteredQuery($user, $filters)->get();
    }

    public function findPaginated(User $user, array $filters, int $perPage, int $page): LengthAwarePaginator
    {
        return $this->filteredQuery($user, $filters)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function findForBoardPeriods(
        array $projectIds,
        string $minimumPeriodStart,
        string $maximumPeriodStart,
    ): Collection {
        if ($projectIds === []) {
            return new Collection;
        }

        return $this->query()
            ->with(['project.managerUser:id,department_id', 'project.salesUser:id,department_id', 'customer', 'reporter', 'approver'])
            ->whereIn('project_id', $projectIds)
            ->whereBetween('week_start_date', [$minimumPeriodStart, $maximumPeriodStart])
            ->orderByDesc('created_at')
            ->get();
    }

    public function existsForPeriod(int $projectId, string $periodStart, string $periodEnd): bool
    {
        $dueDate = CarbonImmutable::parse($periodEnd)->addDay();
        $cycleWeekStart = $dueDate->startOfWeek(CarbonImmutable::MONDAY);
        $cycleWeekEnd = $cycleWeekStart->addDays(6);

        return $this->query()
            ->where('project_id', $projectId)
            ->where(function ($query) use ($periodStart, $periodEnd, $cycleWeekStart, $cycleWeekEnd): void {
                $query
                    ->where(function ($periodQuery) use ($periodStart, $periodEnd): void {
                        $periodQuery
                            ->whereDate('week_start_date', $periodStart)
                            ->whereDate('week_end_date', $periodEnd);
                    })
                    ->orWhereBetween('report_date', [
                        $cycleWeekStart->toDateString(),
                        $cycleWeekEnd->toDateString(),
                    ]);
            })
            ->exists();
    }

    private function filteredQuery(User $user, array $filters): Builder
    {
        $query = $this->query()
            ->with(['project.managerUser:id,department_id', 'project.salesUser:id,department_id', 'customer', 'reporter', 'approver'])
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['reporter_user_id'] ?? null, fn ($query, $value) => $query->where('reporter_user_id', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->when($filters['week_start_date'] ?? null, fn ($query, $value) => $query->whereDate('week_start_date', $value))
            ->when($filters['date_from'] ?? null, fn ($query, $value) => $query->whereDate('week_start_date', '>=', $value))
            ->when($filters['date_to'] ?? null, fn ($query, $value) => $query->whereDate('week_end_date', '<=', $value))
            ->orderByDesc('week_start_date')
            ->orderByDesc('created_at');

        return $this->applyViewScope($query, $user);
    }

    private function applyViewScope(Builder $query, User $user): Builder
    {
        if ($user->hasPermission('weeklyreport.view_all')) {
            return $query;
        }

        if ($user->hasPermission('weeklyreport.view_department') && $user->department_id) {
            $departmentId = $user->department_id;

            return $query->where(function (Builder $scope) use ($departmentId): void {
                $scope
                    ->whereHas('reporter', fn (Builder $reporter) => $reporter->where('department_id', $departmentId))
                    ->orWhereHas('project.managerUser', fn (Builder $manager) => $manager->where('department_id', $departmentId))
                    ->orWhereHas('project.salesUser', fn (Builder $sales) => $sales->where('department_id', $departmentId));
            });
        }

        if ($user->hasPermission('weeklyreport.view')) {
            return $query->where(function (Builder $scope) use ($user): void {
                $scope
                    ->where('reporter_user_id', $user->id)
                    ->orWhereHas('project', fn (Builder $project) => $project
                        ->where('manager_user_id', $user->id)
                        ->orWhere('sales_user_id', $user->id));
            });
        }

        return $query->whereRaw('1 = 0');
    }

    public function findVisibleWithRelationsOrFail(User $user, string $id): WeeklyReport
    {
        /** @var WeeklyReport|null $report */
        $report = $this->applyViewScope(
            $this->query()->with([
                'project.managerUser:id,department_id',
                'project.salesUser:id,department_id',
                'customer',
                'reporter',
                'approver',
                'items.assignee',
                'attachments.uploadedBy',
            ]),
            $user,
        )->whereKey($id)->first();

        if (! $report) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $report;
    }

    public function findWithRelationsOrFail(string $id): WeeklyReport
    {
        /** @var WeeklyReport|null $report */
        $report = $this->query()
            ->with(['project.managerUser:id,department_id', 'project.salesUser:id,department_id', 'customer', 'reporter', 'approver', 'items.assignee', 'attachments.uploadedBy'])
            ->whereKey($id)
            ->first();

        if (! $report) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $report;
    }
}
