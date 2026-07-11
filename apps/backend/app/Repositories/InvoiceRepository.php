<?php

namespace App\Repositories;

use App\Models\Invoice;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class InvoiceRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Hóa đơn không tồn tại';

    protected function model(): string
    {
        return Invoice::class;
    }

    public function findAll(array $filters = []): Collection
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));

        return $this->query()
            ->with(['revenue.project', 'customer'])
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('invoice_no', 'ilike', "%{$keyword}%")
                    ->orWhere('company_name', 'ilike', "%{$keyword}%")
                    ->orWhere('tax_code', 'ilike', "%{$keyword}%");
            }))
            ->when($filters['customer_id'] ?? null, fn ($query, $value) => $query->where('customer_id', $value))
            ->when($filters['revenue_id'] ?? null, fn ($query, $value) => $query->where('revenue_id', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Invoice
    {
        /** @var Invoice|null $invoice */
        $invoice = $this->query()
            ->with(['revenue.project', 'customer'])
            ->whereKey($id)
            ->first();

        if (! $invoice) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $invoice;
    }
}
