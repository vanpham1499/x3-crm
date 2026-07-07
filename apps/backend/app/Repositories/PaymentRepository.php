<?php

namespace App\Repositories;

use App\Models\Payment;
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
        return $this->query()
            ->with(['quotation', 'lead', 'customer', 'project', 'contract', 'revenue'])
            ->when($filters['quotation_id'] ?? null, fn ($query, $value) => $query->where('quotation_id', $value))
            ->when($filters['lead_id'] ?? null, fn ($query, $value) => $query->where('lead_id', $value))
            ->when($filters['customer_id'] ?? null, fn ($query, $value) => $query->where('customer_id', $value))
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['contract_id'] ?? null, fn ($query, $value) => $query->where('contract_id', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->orderByDesc('transaction_date')
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Payment
    {
        /** @var Payment|null $payment */
        $payment = $this->query()
            ->with(['quotation', 'lead', 'customer', 'project', 'contract', 'revenue'])
            ->whereKey($id)
            ->first();

        if (! $payment) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $payment;
    }
}
