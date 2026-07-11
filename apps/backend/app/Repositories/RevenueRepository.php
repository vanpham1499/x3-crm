<?php

namespace App\Repositories;

use App\Models\Revenue;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class RevenueRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Doanh thu không tồn tại';

    protected function model(): string
    {
        return Revenue::class;
    }

    public function findAll(array $filters = []): Collection
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));

        return $this->query()
            ->with(['project.customer', 'items.service'])
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('revenue_code', 'ilike', "%{$keyword}%")
                    ->orWhere('note', 'ilike', "%{$keyword}%");
            }))
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['payment_status'] ?? null, fn ($query, $value) => $query->where('payment_status', $value))
            ->when($filters['invoice_status'] ?? null, fn ($query, $value) => $query->where('invoice_status', $value))
            ->when($filters['revenue_month'] ?? null, fn ($query, $value) => $query->whereRaw("to_char(revenue_month, 'YYYY-MM') = ?", [$value]))
            ->orderByDesc('reported_date')
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Revenue
    {
        /** @var Revenue|null $revenue */
        $revenue = $this->query()
            ->with(['project.customer', 'items.service'])
            ->whereKey($id)
            ->first();

        if (! $revenue) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $revenue;
    }
}
