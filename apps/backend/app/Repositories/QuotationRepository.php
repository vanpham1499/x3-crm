<?php

namespace App\Repositories;

use App\Models\Quotation;
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
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));

        return $this->query()
            ->with(['lead', 'customer', 'project', 'contract', 'service', 'items.service'])
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('quotation_code', 'ilike', "%{$keyword}%")
                    ->orWhere('service_code', 'ilike', "%{$keyword}%")
                    ->orWhere('service_name', 'ilike', "%{$keyword}%")
                    ->orWhere('note', 'ilike', "%{$keyword}%");
            }))
            ->when($filters['lead_id'] ?? null, fn ($query, $value) => $query->where('lead_id', $value))
            ->when($filters['customer_id'] ?? null, fn ($query, $value) => $query->where('customer_id', $value))
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['contract_id'] ?? null, fn ($query, $value) => $query->where('contract_id', $value))
            ->when($filters['service_id'] ?? null, fn ($query, $value) => $query->where('service_id', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Quotation
    {
        /** @var Quotation|null $quotation */
        $quotation = $this->query()
            ->with(['lead', 'customer', 'project', 'contract', 'service', 'items.service', 'payments'])
            ->whereKey($id)
            ->first();

        if (! $quotation) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $quotation;
    }

    public function findByCode(?string $code): ?Quotation
    {
        if (! $code) {
            return null;
        }

        return $this->query()->with(['lead', 'customer', 'project', 'contract', 'service', 'items.service'])->where('quotation_code', $code)->first();
    }
}
