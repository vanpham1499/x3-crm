<?php

namespace App\Repositories;

use App\Models\ProjectCost;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectCostRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Chi phí dự án không tồn tại';

    protected function model(): string
    {
        return ProjectCost::class;
    }

    public function findAll(array $filters = []): Collection
    {
        return $this->filteredQuery($filters)->get();
    }

    public function findPaginated(array $filters, int $perPage, int $page): LengthAwarePaginator
    {
        if (! filter_var($filters['group_by_project'] ?? false, FILTER_VALIDATE_BOOL)) {
            return $this->filteredQuery($filters)
                ->paginate($perPage, ['*'], 'page', $page);
        }

        $groupPaginator = DB::query()
            ->fromSub($this->filteredQuery($filters)->toBase(), 'ordered_costs')
            ->select('project_group_id')
            ->selectRaw('MAX(project_group_latest_at) AS project_group_latest_at')
            ->groupBy('project_group_id')
            ->orderByDesc('project_group_latest_at')
            ->orderByDesc('project_group_id')
            ->paginate($perPage, ['*'], 'page', $page);
        $groupIds = collect($groupPaginator->items())
            ->pluck('project_group_id')
            ->values();

        if ($groupIds->isEmpty()) {
            return $groupPaginator->setCollection(new Collection);
        }

        $costIds = DB::query()
            ->fromSub($this->filteredQuery($filters)->toBase(), 'ordered_costs')
            ->whereIn('project_group_id', $groupIds)
            ->orderByDesc('project_group_latest_at')
            ->orderByDesc('project_group_id')
            ->orderByRaw('transaction_date DESC NULLS LAST')
            ->orderByDesc('created_at')
            ->pluck('id');
        $costs = $this->query()
            ->with($this->relations())
            ->whereIn('id', $costIds)
            ->get()
            ->keyBy(fn (ProjectCost $cost): string => (string) $cost->id);
        $orderedCosts = new Collection(
            $costIds
                ->map(fn ($costId) => $costs->get((string) $costId))
                ->filter()
                ->values()
                ->all(),
        );

        return $groupPaginator->setCollection($orderedCosts);
    }

    public function findWithRelationsOrFail(string $id): ProjectCost
    {
        /** @var ProjectCost|null $cost */
        $cost = $this->query()
            ->with($this->relations())
            ->whereKey($id)
            ->first();

        if (! $cost) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $cost;
    }

    public function findForUpdateOrFail(string $id): ProjectCost
    {
        /** @var ProjectCost|null $cost */
        $cost = $this->query()
            ->whereKey($id)
            ->lockForUpdate()
            ->first();

        if (! $cost) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $cost;
    }

    private function filteredQuery(array $filters): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $dateFrom = $filters['date_from'] ?? null;
        $dateTo = $filters['date_to'] ?? null;

        $query = $this->query()
            ->with($this->relations())
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('cid', 'ilike', "%{$keyword}%")
                    ->orWhere('ad_account', 'ilike', "%{$keyword}%")
                    ->orWhere('invoice_number', 'ilike', "%{$keyword}%")
                    ->orWhere('note', 'ilike', "%{$keyword}%")
                    ->orWhereHas('project', fn ($relation) => $relation
                        ->where('project_code', 'ilike', "%{$keyword}%")
                        ->orWhere('project_name', 'ilike', "%{$keyword}%")
                        ->orWhereHas('customer', fn ($customer) => $customer
                            ->where('customer_code', 'ilike', "%{$keyword}%")
                            ->orWhere('customer_name', 'ilike', "%{$keyword}%")))
                    ->orWhereHas('quotation', fn ($relation) => $relation
                        ->where('quotation_code', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('bankAccountOption', fn ($relation) => $relation
                        ->where('label', 'ilike', "%{$keyword}%")
                        ->orWhere('value', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('partnerOption', fn ($relation) => $relation
                        ->where('label', 'ilike', "%{$keyword}%")
                        ->orWhere('value', 'ilike', "%{$keyword}%"));
            }))
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['quotation_id'] ?? null, fn ($query, $value) => $query->where('quotation_id', $value))
            ->when($filters['entry_type'] ?? null, fn ($query, $value) => $query->where('entry_type', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->when($filters['reconciliation_result'] ?? null, fn ($query, $value) => $query->where('reconciliation_result', $value))
            ->when(($filters['reconciled_status'] ?? null) === 'matched', fn ($query) => $query->whereNotNull('reconciled_at'))
            ->when(($filters['reconciled_status'] ?? null) === 'unmatched', fn ($query) => $query->whereNull('reconciled_at'))
            ->when(($filters['balance_status'] ?? null) === 'pending', fn ($query) => $this->balanceStatusQuery($query, 'pending'))
            ->when(($filters['balance_status'] ?? null) === 'resolved', fn ($query) => $this->balanceStatusQuery($query, 'resolved'))
            ->when(($filters['balance_status'] ?? null) === 'none', fn ($query) => $this->balanceStatusQuery($query, 'none'))
            ->when($dateFrom, fn ($query) => $query->whereDate('transaction_date', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('transaction_date', '<=', $dateTo));

        if (! filter_var($filters['group_by_project'] ?? false, FILTER_VALIDATE_BOOL)) {
            return $query
                ->orderByRaw('transaction_date DESC NULLS LAST')
                ->orderByDesc('created_at');
        }

        return $query
            ->select('project_costs.*')
            ->selectRaw('project_costs.project_id AS project_group_id')
            ->selectRaw('MAX(COALESCE(project_costs.transaction_date::timestamp, project_costs.created_at)) OVER (PARTITION BY project_costs.project_id) AS project_group_latest_at')
            ->orderByDesc('project_group_latest_at')
            ->orderByDesc('project_group_id')
            ->orderByRaw('transaction_date DESC NULLS LAST')
            ->orderByDesc('created_at');
    }

    private function relations(): array
    {
        return [
            'project.customer',
            'quotation',
            'bankAccountOption',
            'partnerOption',
            'reconciledBy',
            'adjustments',
        ];
    }

    private function balanceStatusQuery(Builder $query, string $status): Builder
    {
        $balanceSql = 'GREATEST(project_costs.total_amount - COALESCE(project_costs.cid_spent_amount, 0), 0)';

        if ($status === 'none') {
            return $query->where(function ($query) use ($balanceSql): void {
                $query
                    ->where('entry_type', '!=', ProjectCost::TYPE_AD_SPEND)
                    ->orWhere('cid_is_dead', false)
                    ->orWhereRaw("{$balanceSql} <= 0");
            });
        }

        return $query
            ->where('entry_type', ProjectCost::TYPE_AD_SPEND)
            ->where('cid_is_dead', true)
            ->whereRaw("{$balanceSql} > 0")
            ->when(
                $status === 'pending',
                fn ($query) => $query->whereNull('reconciled_at'),
                fn ($query) => $query->whereNotNull('reconciled_at'),
            );
    }
}
