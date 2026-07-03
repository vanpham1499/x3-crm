<?php

namespace App\Services;

use App\Http\Resources\LeadResource;
use App\Models\Lead;
use App\Models\Status;
use App\Repositories\LeadRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LeadsService extends BaseService
{
    public function __construct(private readonly LeadRepository $leads) {}

    public function findAll(array $filters = [])
    {
        $filters = $this->normalizeFilters($filters);

        return $this->apiCollection($this->leads->findAll($filters), LeadResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->leads->findWithRelationsOrFail($id), LeadResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizePayload($data);
            $data['lead_code'] = $data['lead_code'] ?? $this->generateLeadCode();
            $data['status_id'] = $data['status_id'] ?? $this->defaultStatusId();

            /** @var Lead $lead */
            $lead = $this->leads->create($data);

            return $this->apiResource($lead->load(['status', 'assignedUser', 'source', 'interestedService']), LeadResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $data = $this->normalizePayload($data);

            /** @var Lead $lead */
            $lead = $this->leads->update($id, $data);

            return $this->apiResource($lead->load(['status', 'assignedUser', 'source', 'interestedService']), LeadResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->leads->delete($id);

            return ['message' => 'Xoa lead thanh cong'];
        });
    }

    private function normalizeFilters(array $filters): array
    {
        return $this->normalizeKeys($filters);
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        foreach (['lead_code', 'status_id', 'assigned_user_id', 'source_id', 'interested_service_id'] as $key) {
            if (array_key_exists($key, $data) && ($data[$key] === '' || $data[$key] === null)) {
                unset($data[$key]);
            }
        }

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'leadCode' => 'lead_code',
            'customerName' => 'customer_name',
            'statusId' => 'status_id',
            'occurredDate' => 'occurred_date',
            'assignedUserId' => 'assigned_user_id',
            'sourceId' => 'source_id',
            'interestedServiceId' => 'interested_service_id',
            'interestedServiceText' => 'interested_service_text',
            'planLink' => 'plan_link',
            'zaloGroup' => 'zalo_group',
            'closedDate' => 'closed_date',
            'convertedCustomerId' => 'converted_customer_id',
            'occurredFrom' => 'occurred_from',
            'occurredTo' => 'occurred_to',
            'closedFrom' => 'closed_from',
            'closedTo' => 'closed_to',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function generateLeadCode(): string
    {
        do {
            $code = 'LD'.now()->format('ymdHis').Str::upper(Str::random(4));
        } while ($this->leads->existsByCode($code));

        return $code;
    }

    private function defaultStatusId(): string
    {
        $statusId = DB::table('statuses')
            ->where('type', Status::TYPE_LEAD)
            ->where('name', 'Moi')
            ->whereNull('deleted_at')
            ->value('id');

        if ($statusId) {
            return $statusId;
        }

        $id = (string) Str::uuid();

        DB::table('statuses')->insert([
            'id' => $id,
            'type' => Status::TYPE_LEAD,
            'name' => 'Moi',
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }
}
