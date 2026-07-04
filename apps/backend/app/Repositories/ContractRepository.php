<?php

namespace App\Repositories;

use App\Models\Contract;
use App\Models\Option;
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
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $projectId = $filters['project_id'] ?? null;
        $statusOptionId = $filters['contract_status_option_id'] ?? null;
        $status = $filters['status'] ?? null;

        return $this->query()
            ->with(['project.customer', 'project.service', 'contractStatusOption'])
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query
                        ->where('contract_no', 'ilike', "%{$keyword}%")
                        ->orWhere('contract_month', 'ilike', "%{$keyword}%")
                        ->orWhere('note', 'ilike', "%{$keyword}%")
                        ->orWhereHas('project', fn ($subQuery) => $subQuery
                            ->where('project_code', 'ilike', "%{$keyword}%")
                            ->orWhere('project_name', 'ilike', "%{$keyword}%"));
                });
            })
            ->when($projectId, fn ($query) => $query->where('project_id', $projectId))
            ->when($statusOptionId, fn ($query) => $query->where('contract_status_option_id', $statusOptionId))
            ->when($status, fn ($query) => $query->whereHas('contractStatusOption', fn ($subQuery) => $subQuery->where('group', Option::GROUP_CONTRACT_STATUS)->where('key', $status)))
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Contract
    {
        /** @var Contract|null $contract */
        $contract = $this->query()
            ->with(['project.customer', 'project.service', 'contractStatusOption'])
            ->whereKey($id)
            ->first();

        if (! $contract) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $contract;
    }
}
