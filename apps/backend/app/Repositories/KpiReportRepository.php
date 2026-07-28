<?php

namespace App\Repositories;

use App\Models\Department;
use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\Quotation;
use App\Models\Service;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class KpiReportRepository
{
    public function services(): Collection
    {
        return Service::query()
            ->withTrashed()
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get(['id', 'parent_id', 'code', 'name', 'sort_order', 'is_active', 'deleted_at']);
    }

    public function departments(): Collection
    {
        return Department::query()
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    public function activeProjects(): Collection
    {
        return Project::query()
            ->whereNull('deleted_at')
            ->with([
                'managerUser:id,department_id',
                'customer:id,sales_user_id',
                'customer.salesUser:id,department_id',
            ])
            ->get(['id', 'service_id', 'manager_user_id', 'customer_id']);
    }

    public function quotations(Collection $projectIds): Collection
    {
        if ($projectIds->isEmpty()) {
            return collect();
        }

        return Quotation::query()
            ->whereIn('project_id', $projectIds)
            ->get([
                'id',
                'project_id',
                'quotation_code',
                'subtotal_amount',
                'vat_amount',
                'total_amount',
                'deposit_amount',
            ]);
    }

    public function allocations(Collection $quotationIds): Collection
    {
        if ($quotationIds->isEmpty()) {
            return collect();
        }

        return PaymentAllocation::query()
            ->with('payment:id,transaction_date,transaction_at')
            ->whereIn('quotation_id', $quotationIds)
            ->get(['id', 'payment_id', 'quotation_id', 'project_id', 'amount', 'allocated_at', 'created_at']);
    }

    public function completedRefunds(
        string $periodStart,
        string $periodEnd,
        Collection $projectIds,
        Collection $quotationIds,
    ): Collection {
        if ($projectIds->isEmpty()) {
            return collect();
        }

        return PaymentRefund::query()
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->where('completed_at', '>=', $periodStart)
            ->where('completed_at', '<', $periodEnd)
            ->where(function (Builder $query) use ($projectIds, $quotationIds): void {
                $query->whereIn('project_id', $projectIds);

                if ($quotationIds->isNotEmpty()) {
                    $query->orWhereIn('quotation_id', $quotationIds);
                }
            })
            ->get([
                'id',
                'project_id',
                'quotation_id',
                'payment_allocation_id',
                'refund_type',
                'amount',
                'completed_at',
            ]);
    }

    public function completedCosts(
        string $periodStart,
        string $periodEnd,
        Collection $projectIds,
    ): Collection {
        if ($projectIds->isEmpty()) {
            return collect();
        }

        return ProjectCost::query()
            ->with(['adjustments', 'cidIncident'])
            ->whereIn('project_id', $projectIds)
            ->where('status', ProjectCost::STATUS_COMPLETED)
            ->where('transaction_date', '>=', $periodStart)
            ->where('transaction_date', '<', $periodEnd)
            ->get();
    }
}
