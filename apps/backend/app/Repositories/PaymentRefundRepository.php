<?php

namespace App\Repositories;

use App\Models\PaymentRefund;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class PaymentRefundRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Khoản trả khách không tồn tại';

    protected function model(): string
    {
        return PaymentRefund::class;
    }

    public function findPaginated(array $filters, int $perPage, int $page): LengthAwarePaginator
    {
        return $this->filteredQuery($filters)->paginate($perPage, ['*'], 'page', $page);
    }

    private function filteredQuery(array $filters): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? ''));
        $dateFrom = $filters['date_from'] ?? null;
        $dateTo = $filters['date_to'] ?? null;

        return $this->query()
            ->with($this->relations())
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('recipient_name', 'ilike', "%{$keyword}%")
                    ->orWhere('recipient_account', 'ilike', "%{$keyword}%")
                    ->orWhere('recipient_bank', 'ilike', "%{$keyword}%")
                    ->orWhere('reference', 'ilike', "%{$keyword}%")
                    ->orWhere('reason', 'ilike', "%{$keyword}%")
                    ->orWhere('note', 'ilike', "%{$keyword}%")
                    ->orWhereHas('payment', fn ($relation) => $relation
                        ->where('transaction_content', 'ilike', "%{$keyword}%")
                        ->orWhere('reference', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('quotation', fn ($relation) => $relation
                        ->where('quotation_code', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('project', fn ($relation) => $relation
                        ->where('project_code', 'ilike', "%{$keyword}%")
                        ->orWhere('project_name', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('customer', fn ($relation) => $relation
                        ->where('customer_code', 'ilike', "%{$keyword}%")
                        ->orWhere('customer_name', 'ilike', "%{$keyword}%"));
            }))
            ->when($filters['refund_type'] ?? null, fn ($query, $value) => $query->where('refund_type', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->when($dateFrom, fn ($query) => $query->where(function ($query) use ($dateFrom): void {
                $query
                    ->whereDate('completed_at', '>=', $dateFrom)
                    ->orWhere(function ($query) use ($dateFrom): void {
                        $query->whereNull('completed_at')->whereDate('scheduled_at', '>=', $dateFrom);
                    });
            }))
            ->when($dateTo, fn ($query) => $query->where(function ($query) use ($dateTo): void {
                $query
                    ->whereDate('completed_at', '<=', $dateTo)
                    ->orWhere(function ($query) use ($dateTo): void {
                        $query->whereNull('completed_at')->whereDate('scheduled_at', '<=', $dateTo);
                    });
            }))
            ->orderByRaw('COALESCE(completed_at, scheduled_at) DESC NULLS LAST')
            ->orderByDesc('created_at');
    }

    public function relations(): array
    {
        return [
            'payment',
            'allocation',
            'quotation',
            'customer',
            'project',
            'createdBy',
        ];
    }
}
