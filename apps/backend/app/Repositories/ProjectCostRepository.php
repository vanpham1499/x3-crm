<?php

namespace App\Repositories;

use App\Models\ProjectCost;
use Illuminate\Database\Eloquent\Collection;
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
        return $this->query()
            ->with(['quotation', 'bankAccountOption', 'partnerOption'])
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['quotation_id'] ?? null, fn ($query, $value) => $query->where('quotation_id', $value))
            ->when($filters['entry_type'] ?? null, fn ($query, $value) => $query->where('entry_type', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->orderByDesc('transaction_date')
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): ProjectCost
    {
        /** @var ProjectCost|null $cost */
        $cost = $this->query()
            ->with(['quotation', 'bankAccountOption', 'partnerOption'])
            ->whereKey($id)
            ->first();

        if (! $cost) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $cost;
    }
}
