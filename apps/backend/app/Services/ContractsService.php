<?php

namespace App\Services;

use App\Http\Resources\ContractResource;
use App\Models\Contract;
use App\Repositories\ContractRepository;

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
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizePayload($data);

            /** @var Contract $contract */
            $contract = $this->contracts->create($data);

            return $this->apiResource($contract->load(['project', 'quotation', 'lead', 'customer', 'contractStatus', 'contractStatusOption']), ContractResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var Contract $contract */
            $contract = $this->contracts->update($id, $this->normalizePayload($data));

            return $this->apiResource($contract->load(['project', 'quotation', 'lead', 'customer', 'contractStatus', 'contractStatusOption']), ContractResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->contracts->delete($id);

            return ['message' => 'Xóa hợp đồng thành công'];
        });
    }

    private function normalizePayload(array $data): array
    {
        return $this->normalizeKeys($data);
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'projectId' => 'project_id',
            'quotationId' => 'quotation_id',
            'leadId' => 'lead_id',
            'customerId' => 'customer_id',
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
}
