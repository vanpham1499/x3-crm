<?php

namespace App\Repositories;

use App\Models\Quotation;
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

        return $this->query()
            ->with(['lead', 'customer', 'project', 'contract', 'service', 'items.service', 'paymentAllocations'])
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
            ->orderByDesc('created_at');
    }

    public function findWithRelationsOrFail(string $id): Quotation
    {
        /** @var Quotation|null $quotation */
        $quotation = $this->query()
            ->with(['lead', 'customer', 'project', 'contract', 'service', 'items.service', 'paymentAllocations'])
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
        ]);
    }

    public function findByCode(?string $code): ?Quotation
    {
        if (! $code) {
            return null;
        }

        return $this->query()->with(['lead', 'customer', 'project', 'contract', 'service', 'items.service', 'paymentAllocations'])->where('quotation_code', $code)->first();
    }
}
