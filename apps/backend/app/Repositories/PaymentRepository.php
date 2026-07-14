<?php

namespace App\Repositories;

use App\Models\Payment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
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
        return $this->filteredQuery($filters)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    private function filteredQuery(array $filters): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $dateFrom = $filters['date_from'] ?? null;
        $dateTo = $filters['date_to'] ?? null;

        return $this->query()
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
            }))
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
