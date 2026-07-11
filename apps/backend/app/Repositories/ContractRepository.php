<?php

namespace App\Repositories;

use App\Models\Contract;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ContractRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Hợp đồng không tồn tại';

    protected function model(): string
    {
        return Contract::class;
    }

    public function findAll(array $filters = []): Collection
    {
        return $this->query()
            ->with(['project', 'quotation', 'lead', 'customer', 'contractStatus', 'contractStatusOption'])
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['quotation_id'] ?? null, fn ($query, $value) => $query->where('quotation_id', $value))
            ->when($filters['lead_id'] ?? null, fn ($query, $value) => $query->where('lead_id', $value))
            ->when($filters['customer_id'] ?? null, fn ($query, $value) => $query->where('customer_id', $value))
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Contract
    {
        /** @var Contract|null $contract */
        $contract = $this->query()
            ->with(['project', 'quotation', 'lead', 'customer', 'contractStatus', 'contractStatusOption', 'payments'])
            ->whereKey($id)
            ->first();

        if (! $contract) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $contract;
    }
}
