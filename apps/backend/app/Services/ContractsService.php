<?php

namespace App\Services;

use App\Http\Resources\ContractResource;
use App\Models\Contract;
use App\Models\Option;
use App\Repositories\ContractRepository;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class ContractsService extends BaseService
{
    public function __construct(private readonly ContractRepository $contracts) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->contracts->findAll($this->normalizeKeys($filters)), ContractResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->contracts->findWithRelationsOrFail($id), ContractResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(fn (): array => $this->apiResource(
            $this->createForProject($this->normalizeKeys($data)['project_id'], $data),
            ContractResource::class
        ));
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $contract = $this->updateForProject($id, $data);

            return $this->apiResource($contract, ContractResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->contracts->delete($id);

            return ['message' => 'Xóa hợp đồng thành công'];
        });
    }

    public function createForProject(string $projectId, array $data): Contract
    {
        $data = $this->normalizePayload($data);
        $data['project_id'] = $projectId;
        $data['contract_status_option_id'] = $data['contract_status_option_id'] ?? $this->defaultStatusOption()->id;

        /** @var Contract $contract */
        $contract = $this->contracts->create($data);

        return $this->loadContractRelations($contract);
    }

    public function updateForProject(string $id, array $data): Contract
    {
        $data = $this->normalizePayload($data);

        /** @var Contract $contract */
        $contract = $this->contracts->update($id, $data);

        return $this->loadContractRelations($contract);
    }

    public function syncForProject(string $projectId, ?array $data): ?Contract
    {
        if ($data === null) {
            return null;
        }

        $data = $this->normalizeKeys($data);
        $delete = (bool) ($data['delete'] ?? $data['_delete'] ?? false);
        $contractId = $data['id'] ?? null;
        unset($data['delete'], $data['_delete']);

        if ($delete && $contractId) {
            $this->ensureContractBelongsToProject($contractId, $projectId);
            $this->contracts->delete($contractId);

            return null;
        }

        if ($contractId) {
            $this->ensureContractBelongsToProject($contractId, $projectId);
            $data['project_id'] = $projectId;

            return $this->updateForProject($contractId, $data);
        }

        return $this->createForProject($projectId, $data);
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        foreach (['contract_status_id', 'contract_status_option_id'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        foreach (['contract_no', 'contract_month', 'file_url', 'note'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'projectId' => 'project_id',
            'contractNo' => 'contract_no',
            'contractStatusId' => 'contract_status_id',
            'contractStatusOptionId' => 'contract_status_option_id',
            'depositAmount' => 'deposit_amount',
            'signedDate' => 'signed_date',
            'expiredDate' => 'expired_date',
            'contractMonth' => 'contract_month',
            'fileUrl' => 'file_url',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function loadContractRelations(Contract $contract): Contract
    {
        return $contract->load(['project.customer', 'project.service', 'contractStatusOption']);
    }

    private function ensureContractBelongsToProject(string $contractId, string $projectId): void
    {
        /** @var Contract $contract */
        $contract = $this->contracts->findOrFail($contractId);

        if ($contract->project_id !== $projectId) {
            throw new BadRequestHttpException('Hợp đồng không thuộc dự án này');
        }
    }

    private function defaultStatusOption(): Option
    {
        return Option::query()->firstOrCreate(
            [
                'group' => Option::GROUP_CONTRACT_STATUS,
                'key' => 'new',
            ],
            [
                'value' => 'new',
                'label' => 'Mới',
                'meta' => ['color' => '#3b82f6'],
                'sort_order' => 0,
                'is_active' => true,
            ]
        );
    }
}
