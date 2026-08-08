<?php

namespace App\Repositories;

use App\Models\Option;
use App\Models\Project;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Dự án không tồn tại';

    protected function model(): string
    {
        return Project::class;
    }

    public function findAll(array $filters = [], ?User $user = null): Collection
    {
        return $this->filteredQuery($filters, $user)->get();
    }

    public function findPaginated(array $filters, int $perPage, int $page, ?User $user = null): LengthAwarePaginator
    {
        return $this->filteredQuery($filters, $user)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    private function filteredQuery(array $filters, ?User $user = null): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $customerId = $filters['customer_id'] ?? null;
        $serviceId = $filters['service_id'] ?? null;
        $statusOptionId = $filters['status_option_id'] ?? null;
        $status = $filters['status'] ?? null;
        $managerUserId = $filters['manager_user_id'] ?? null;
        $salesUserId = $filters['sales_user_id'] ?? null;

        $query = $this->query()
            ->with(['customer', 'quotation', 'service', 'statusOption', 'managerUser', 'salesUser', 'createdBy']);

        $this->applyViewScope($query, $user);

        return $query
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query
                        ->where('project_code', 'ilike', "%{$keyword}%")
                        ->orWhere('project_name', 'ilike', "%{$keyword}%")
                        ->orWhere('zalo_group', 'ilike', "%{$keyword}%")
                        ->orWhere('plan_link', 'ilike', "%{$keyword}%")
                        ->orWhere('note', 'ilike', "%{$keyword}%")
                        ->orWhereHas('customer', function ($customerQuery) use ($keyword): void {
                            $customerQuery
                                ->where('customer_code', 'ilike', "%{$keyword}%")
                                ->orWhere('customer_name', 'ilike', "%{$keyword}%")
                                ->orWhere('company_name', 'ilike', "%{$keyword}%");
                        });
                });
            })
            ->when($customerId, fn ($query) => $query->where('customer_id', $customerId))
            ->when($serviceId, fn ($query) => $query->where('service_id', $serviceId))
            ->when($statusOptionId, fn ($query) => $query->where('status_option_id', $statusOptionId))
            ->when($status, fn ($query) => $query->whereHas('statusOption', fn ($subQuery) => $subQuery->where('group', Option::GROUP_PROJECT_STATUS)->where('key', $status)))
            ->when($managerUserId, fn ($query) => $query->where('manager_user_id', $managerUserId))
            ->when($salesUserId, fn ($query) => $query->where('sales_user_id', $salesUserId))
            ->orderByDesc('created_at');
    }

    private function applyViewScope(Builder $query, ?User $user): void
    {
        if (! $user || $user->hasPermission('project.view_all')) {
            return;
        }

        $departmentIds = $user->accessibleDepartmentIds();

        if ($user->hasPermission('project.view_department') && $departmentIds !== []) {
            $query->where(function (Builder $scope) use ($departmentIds): void {
                $scope
                    ->whereHas('managerUser', fn (Builder $manager) => $manager->whereIn('department_id', $departmentIds))
                    ->orWhereHas('salesUser', fn (Builder $sales) => $sales->whereIn('department_id', $departmentIds));
            });

            return;
        }

        if ($user->hasPermission('project.view')) {
            $query->where(function (Builder $scope) use ($user): void {
                $scope
                    ->where('manager_user_id', $user->id)
                    ->orWhere('sales_user_id', $user->id);
            });

            return;
        }

        $query->whereRaw('1 = 0');
    }

    public function findWithRelationsOrFail(string $id): Project
    {
        /** @var Project|null $project */
        $project = $this->query()
            ->with(['customer', 'quotation', 'quotations', 'service', 'statusOption', 'managerUser', 'salesUser', 'createdBy', 'weeklySetting.reportOwner', 'timelines.createdBy'])
            ->whereKey($id)
            ->first();

        if (! $project) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $project;
    }
}
