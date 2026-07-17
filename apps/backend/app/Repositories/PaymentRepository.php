<?php

namespace App\Repositories;

use App\Models\Payment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PaymentRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Thanh toán không tồn tại';

    protected function model(): string
    {
        return Payment::class;
    }

    public function findAll(array $filters = []): Collection
    {
        return $this->filteredQuery($filters)->get();
    }

    public function findPaginated(array $filters, int $perPage, int $page): LengthAwarePaginator
    {
        if (! filter_var($filters['group_by_quotation'] ?? false, FILTER_VALIDATE_BOOL)) {
            return $this->filteredQuery($filters)
                ->paginate($perPage, ['*'], 'page', $page);
        }

        $groupPaginator = DB::query()
            ->fromSub($this->filteredQuery($filters)->toBase(), 'ordered_payments')
            ->select('quotation_group_id')
            ->selectRaw('MAX(quotation_group_latest_at) AS quotation_group_latest_at')
            ->groupBy('quotation_group_id')
            ->orderByDesc('quotation_group_latest_at')
            ->orderByDesc('quotation_group_id')
            ->paginate($perPage, ['*'], 'page', $page);
        $groupIds = collect($groupPaginator->items())
            ->pluck('quotation_group_id')
            ->values();

        if ($groupIds->isEmpty()) {
            return $groupPaginator->setCollection(new Collection);
        }

        $paymentIds = DB::query()
            ->fromSub($this->filteredQuery($filters)->toBase(), 'ordered_payments')
            ->whereIn('quotation_group_id', $groupIds)
            ->orderByDesc('quotation_group_latest_at')
            ->orderByDesc('quotation_group_id')
            ->orderByRaw('transaction_at DESC NULLS LAST')
            ->orderByDesc('transaction_date')
            ->orderByDesc('created_at')
            ->pluck('id');
        $payments = $this->query()
            ->with([
                'quotation',
                'lead',
                'customer',
                'project',
                'contract',
                'allocations.quotation.customer',
                'allocations.quotation.project',
                'refunds',
            ])
            ->whereIn('id', $paymentIds)
            ->get()
            ->keyBy(fn (Payment $payment): string => (string) $payment->id);
        $orderedPayments = new Collection(
            $paymentIds
                ->map(fn ($paymentId) => $payments->get((string) $paymentId))
                ->filter()
                ->values()
                ->all(),
        );

        return $groupPaginator->setCollection($orderedPayments);
    }

    private function filteredQuery(array $filters): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $dateFrom = $filters['date_from'] ?? null;
        $dateTo = $filters['date_to'] ?? null;

        $query = $this->query()
            ->with([
                'quotation',
                'lead',
                'customer',
                'project',
                'contract',
                'allocations.quotation.customer',
                'allocations.quotation.project',
                'refunds',
            ])
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('transaction_content', 'ilike', "%{$keyword}%")
                    ->orWhere('reference', 'ilike', "%{$keyword}%")
                    ->orWhere('bank_account', 'ilike', "%{$keyword}%")
                    ->orWhere('sender_name', 'ilike', "%{$keyword}%")
                    ->orWhere('customer_code_text', 'ilike', "%{$keyword}%")
                    ->orWhereHas('quotation', fn ($relation) => $relation
                        ->where('quotation_code', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('allocations.quotation', fn ($relation) => $relation
                        ->where('quotation_code', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('project', fn ($relation) => $relation
                        ->where('project_code', 'ilike', "%{$keyword}%")
                        ->orWhere('project_name', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('allocations.quotation.project', fn ($relation) => $relation
                        ->where('project_code', 'ilike', "%{$keyword}%")
                        ->orWhere('project_name', 'ilike', "%{$keyword}%"));
            }))
            ->when($filters['quotation_id'] ?? null, fn ($query, $value) => $query->where(function ($query) use ($value): void {
                $query
                    ->where('quotation_id', $value)
                    ->orWhereHas('allocations', fn ($relation) => $relation->where('quotation_id', $value));
            }))
            ->when($filters['lead_id'] ?? null, fn ($query, $value) => $query->where(function ($query) use ($value): void {
                $query
                    ->where('lead_id', $value)
                    ->orWhereHas('allocations.quotation', fn ($relation) => $relation->where('lead_id', $value));
            }))
            ->when($filters['customer_id'] ?? null, fn ($query, $value) => $query->where(function ($query) use ($value): void {
                $query
                    ->where('customer_id', $value)
                    ->orWhereHas('allocations', fn ($relation) => $relation->where('customer_id', $value));
            }))
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where(function ($query) use ($value): void {
                $query
                    ->where('project_id', $value)
                    ->orWhereHas('allocations', fn ($relation) => $relation->where('project_id', $value));
            }))
            ->when($filters['contract_id'] ?? null, fn ($query, $value) => $query->where(function ($query) use ($value): void {
                $query
                    ->where('contract_id', $value)
                    ->orWhereHas('allocations.quotation', fn ($relation) => $relation->where('contract_id', $value));
            }))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->when($filters['reconciled_status'] ?? null, fn ($query, $value) => $query->where('reconciled_status', $value))
            ->when($dateFrom, fn ($query) => $query->where(function ($query) use ($dateFrom): void {
                $query
                    ->whereDate('transaction_at', '>=', $dateFrom)
                    ->orWhere(fn ($fallback) => $fallback
                        ->whereNull('transaction_at')
                        ->whereDate('transaction_date', '>=', $dateFrom));
            }))
            ->when($dateTo, fn ($query) => $query->where(function ($query) use ($dateTo): void {
                $query
                    ->whereDate('transaction_at', '<=', $dateTo)
                    ->orWhere(fn ($fallback) => $fallback
                        ->whereNull('transaction_at')
                        ->whereDate('transaction_date', '<=', $dateTo));
            }));

        if (! filter_var($filters['group_by_quotation'] ?? false, FILTER_VALIDATE_BOOL)) {
            return $query
                ->orderByRaw('transaction_at DESC NULLS LAST')
                ->orderByDesc('transaction_date')
                ->orderByDesc('created_at');
        }

        $allocationGroups = DB::table('payment_allocations')
            ->select('payment_id')
            ->selectRaw('MIN(quotation_id) AS grouped_quotation_id')
            ->selectRaw('COUNT(DISTINCT quotation_id) AS quotation_count')
            ->whereNull('deleted_at')
            ->groupBy('payment_id');
        $groupExpression = <<<'SQL'
            CASE
                WHEN COALESCE(allocation_group.quotation_count, 0) > 1 THEN -payments.id
                ELSE COALESCE(allocation_group.grouped_quotation_id, payments.quotation_id, -payments.id)
            END
            SQL;

        return $query
            ->leftJoinSub($allocationGroups, 'allocation_group', fn ($join) => $join
                ->on('allocation_group.payment_id', '=', 'payments.id'))
            ->select('payments.*')
            ->selectRaw("{$groupExpression} AS quotation_group_id")
            ->selectRaw("MAX(COALESCE(payments.transaction_at, payments.transaction_date::timestamp, payments.created_at)) OVER (PARTITION BY {$groupExpression}) AS quotation_group_latest_at")
            ->orderByDesc('quotation_group_latest_at')
            ->orderByDesc('quotation_group_id')
            ->orderByRaw('transaction_at DESC NULLS LAST')
            ->orderByDesc('transaction_date')
            ->orderByDesc('created_at');
    }

    public function findWithRelationsOrFail(string $id): Payment
    {
        /** @var Payment|null $payment */
        $payment = $this->query()
            ->with([
                'quotation',
                'lead',
                'customer',
                'project',
                'contract',
                'allocations.quotation.customer',
                'allocations.quotation.project',
                'refunds',
            ])
            ->whereKey($id)
            ->first();

        if (! $payment) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $payment;
    }
}
