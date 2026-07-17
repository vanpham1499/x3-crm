<?php

namespace App\Repositories;

use App\Models\Option;
use App\Models\Project;
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

    public function findAll(array $filters = []): Collection
    {
        return $this->filteredQuery($filters)->get();
    }

    public function findPaginated(array $filters, int $perPage, int $page): LengthAwarePaginator
    {
        return $this->filteredQuery($filters)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    private function filteredQuery(array $filters): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $customerId = $filters['customer_id'] ?? null;
        $serviceId = $filters['service_id'] ?? null;
        $statusOptionId = $filters['status_option_id'] ?? null;
        $status = $filters['status'] ?? null;
        $managerUserId = $filters['manager_user_id'] ?? null;
        $salesUserId = $filters['sales_user_id'] ?? null;

        return $this->query()
            ->with(['customer', 'quotation', 'service', 'statusOption', 'managerUser', 'salesUser'])
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

    public function findWithRelationsOrFail(string $id): Project
    {
        /** @var Project|null $project */
        $project = $this->query()
            ->with(['customer', 'quotation', 'service', 'statusOption', 'managerUser', 'salesUser', 'weeklySetting.reportOwner', 'timelines.createdBy'])
            ->whereKey($id)
            ->first();

        if (! $project) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $project;
    }
}
