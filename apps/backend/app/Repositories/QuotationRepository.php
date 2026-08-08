<?php

namespace App\Repositories;

use App\Models\Quotation;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class QuotationRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Quotation không tồn tại';

    protected function model(): string
    {
        return Quotation::class;
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

        $query = $this->query()
            ->with($this->relations());

        $this->applyViewScope($query, $user);

        return $query
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('quotation_code', 'ilike', "%{$keyword}%")
                    ->orWhere('service_code', 'ilike', "%{$keyword}%")
                    ->orWhere('service_name', 'ilike', "%{$keyword}%")
                    ->orWhere('note', 'ilike', "%{$keyword}%")
                    ->orWhereHas('lead', fn ($relation) => $relation
                        ->where('lead_code', 'ilike', "%{$keyword}%")
                        ->orWhere('customer_name', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('customer', fn ($relation) => $relation
                        ->where('customer_code', 'ilike', "%{$keyword}%")
                        ->orWhere('customer_name', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('project', fn ($relation) => $relation
                        ->where('project_code', 'ilike', "%{$keyword}%")
                        ->orWhere('project_name', 'ilike', "%{$keyword}%"));
            }))
            ->when($filters['lead_id'] ?? null, fn ($query, $value) => $query->where('lead_id', $value))
            ->when($filters['customer_id'] ?? null, fn ($query, $value) => $query->where('customer_id', $value))
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['contract_id'] ?? null, fn ($query, $value) => $query->where('contract_id', $value))
            ->when($filters['service_id'] ?? null, fn ($query, $value) => $query->where('service_id', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->when($filters['created_by'] ?? null, fn ($query, $value) => $query->where('created_by', $value))
            ->when(filter_var($filters['allocation_open'] ?? false, FILTER_VALIDATE_BOOLEAN), fn ($query) => $query
                ->whereNotNull('project_id')
                ->where('status', Quotation::STATUS_DRAFT)
                ->where('total_amount', '>', 0))
            ->orderByDesc('created_at');
    }

    private function applyViewScope(Builder $query, ?User $user): void
    {
        if (! $user || $user->hasPermission('quotation.view_all')) {
            return;
        }

        $departmentIds = $user->hasPermission('quotation.view_department')
            ? $user->accessibleDepartmentIds()
            : [];

        if ($departmentIds !== []) {
            $query->where(function (Builder $scope) use ($departmentIds): void {
                $scope
                    ->where(function (Builder $projectScope) use ($departmentIds): void {
                        $projectScope
                            ->whereNotNull('project_id')
                            ->whereHas('project', fn (Builder $project) => $project
                                ->where(fn (Builder $owners) => $owners
                                    ->whereHas('managerUser', fn (Builder $manager) => $manager->whereIn('department_id', $departmentIds))
                                    ->orWhereHas('salesUser', fn (Builder $sales) => $sales->whereIn('department_id', $departmentIds))));
                    })
                    ->orWhere(function (Builder $customerScope) use ($departmentIds): void {
                        $customerScope
                            ->whereNull('project_id')
                            ->whereNotNull('customer_id')
                            ->whereHas('customer.salesUser', fn (Builder $sales) => $sales->whereIn('department_id', $departmentIds));
                    })
                    ->orWhere(function (Builder $leadScope) use ($departmentIds): void {
                        $leadScope
                            ->whereNull('project_id')
                            ->whereNull('customer_id')
                            ->whereHas('lead.assignedUser', fn (Builder $assigned) => $assigned->whereIn('department_id', $departmentIds));
                    });
            });

            return;
        }

        if ($user->hasPermission('quotation.view')) {
            $query->where(function (Builder $scope) use ($user): void {
                $scope
                    ->where(function (Builder $projectScope) use ($user): void {
                        $projectScope
                            ->whereNotNull('project_id')
                            ->whereHas('project', fn (Builder $project) => $project
                                ->where(fn (Builder $owners) => $owners
                                    ->where('manager_user_id', $user->id)
                                    ->orWhere('sales_user_id', $user->id)));
                    })
                    ->orWhere(function (Builder $customerScope) use ($user): void {
                        $customerScope
                            ->whereNull('project_id')
                            ->whereNotNull('customer_id')
                            ->whereHas('customer', fn (Builder $customer) => $customer->where('sales_user_id', $user->id));
                    })
                    ->orWhere(function (Builder $leadScope) use ($user): void {
                        $leadScope
                            ->whereNull('project_id')
                            ->whereNull('customer_id')
                            ->whereHas('lead', fn (Builder $lead) => $lead->where('assigned_user_id', $user->id));
                    });
            });

            return;
        }

        $query->whereRaw('1 = 0');
    }

    private function relations(): array
    {
        return [
            'lead.assignedUser',
            'customer.salesUser',
            'project.managerUser',
            'project.salesUser',
            'contract',
            'service',
            'items.service',
            'paymentAllocations',
            'paymentRefunds',
            'createdBy',
        ];
    }

    public function findWithRelationsOrFail(string $id): Quotation
    {
        /** @var Quotation|null $quotation */
        $quotation = $this->query()
            ->with($this->relations())
            ->whereKey($id)
            ->first();

        if (! $quotation) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $quotation;
    }

    public function findForUpdateOrFail(string $id): Quotation
    {
        /** @var Quotation|null $quotation */
        $quotation = $this->query()
            ->whereKey($id)
            ->lockForUpdate()
            ->first();

        if (! $quotation) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $quotation->load([
            'lead',
            'customer',
            'project',
            'contract',
            'service',
            'items.service',
            'paymentAllocations',
            'paymentRefunds',
            'createdBy',
        ]);
    }

    public function findByCode(?string $code): ?Quotation
    {
        if (! $code) {
            return null;
        }

        return $this->query()->with(['lead', 'customer', 'project', 'contract', 'service', 'items.service', 'paymentAllocations', 'paymentRefunds', 'createdBy'])->where('quotation_code', $code)->first();
    }
}
