<?php

namespace App\Services;

use App\Http\Resources\LeadResource;
use App\Http\Resources\QuotationResource;
use App\Models\Customer;
use App\Models\CustomerTimeline;
use App\Models\Lead;
use App\Models\Option;
use App\Models\Quotation;
use App\Models\User;
use App\Repositories\LeadRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class LeadsService extends BaseService
{
    public function __construct(
        private readonly LeadRepository $leads,
        private readonly CustomersService $customers,
        private readonly ProjectsService $projects,
        private readonly ContractsService $contracts,
        private readonly QuotationsService $quotations,
    ) {}

    public function findAll(array $filters = [])
    {
        $filters = $this->normalizeFilters($filters);

        return $this->apiCollection($this->leads->findAll($filters), LeadResource::class);
    }

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        $filters = $this->normalizeFilters($filters);

        return $this->apiPaginatedCollection(
            $this->leads->findPaginated($filters, $perPage, $page),
            LeadResource::class,
        );
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->leads->findWithRelationsOrFail($id), LeadResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $serviceOptionIds = $this->extractServiceOptionIds($data);
            $data = $this->normalizePayload($data);
            $data['lead_code'] = $this->generateLeadCode();
            $data['status_option_id'] = $data['status_option_id'] ?? $this->defaultStatusOptionId();

            if ($serviceOptionIds !== null) {
                $data['interested_service_option_id'] = $serviceOptionIds[0] ?? null;
            }

            /** @var Lead $lead */
            $lead = $this->leads->create($data);

            if ($serviceOptionIds !== null) {
                $lead->interestedServiceOptions()->sync($serviceOptionIds);
            }

            $lead = $this->loadLeadRelations($lead);
            $this->recordTimeline($lead, 'create', $this->buildCreatedTimelineContent($lead));

            return $this->apiResource($this->loadLeadRelations($lead), LeadResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $serviceOptionIds = $this->extractServiceOptionIds($data);
            $data = $this->normalizePayload($data);

            $before = $this->loadLeadRelations($this->leads->findWithRelationsOrFail($id));
            $beforeServiceOptionIds = $before->interestedServiceOptions->pluck('id')->sort()->values()->all();

            if ($serviceOptionIds !== null) {
                $data['interested_service_option_id'] = $serviceOptionIds[0] ?? null;
            }

            /** @var Lead $lead */
            $lead = $this->leads->update($id, $data);

            if ($serviceOptionIds !== null) {
                $lead->interestedServiceOptions()->sync($serviceOptionIds);
            }

            $lead = $this->loadLeadRelations($lead);
            $afterServiceOptionIds = $lead->interestedServiceOptions->pluck('id')->sort()->values()->all();
            $changes = $this->describeLeadChanges($before, $lead, $data);

            if ($serviceOptionIds !== null && $beforeServiceOptionIds !== $afterServiceOptionIds) {
                $changes[] = [
                    'field' => 'interested_service_option_ids',
                    'label' => 'Dịch vụ quan tâm',
                    'old' => $this->formatOptionCollection($before->interestedServiceOptions),
                    'new' => $this->formatOptionCollection($lead->interestedServiceOptions),
                ];
            }

            if ($changes !== []) {
                $this->recordTimeline($lead, 'update', $this->buildUpdatedTimelineContent($lead, $changes));
            }

            return $this->apiResource($this->loadLeadRelations($lead), LeadResource::class);
        });
    }

    public function convert(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $data = $this->normalizeConvertPayload($data);

            /** @var Lead|null $lockedLead */
            $lockedLead = Lead::query()->whereKey($id)->lockForUpdate()->first();

            if (! $lockedLead) {
                throw new NotFoundHttpException('Lead không tồn tại');
            }

            if (
                $lockedLead->converted_customer_id ||
                Customer::query()->where('lead_id', $lockedLead->id)->exists()
            ) {
                throw new ConflictHttpException('Lead đã được chuyển đổi');
            }

            $lead = $this->leads->findWithRelationsOrFail($id);

            $quotation = ! empty($data['quotation_id']) ? $this->quotations->findModel($data['quotation_id']) : null;

            if ($quotation && $quotation->lead_id !== $lead->id) {
                throw new ConflictHttpException('Quotation không thuộc lead này');
            }

            $customer = $this->customers->create($this->convertedCustomerPayload($lead, $data['customer'] ?? []), false);
            $project = $this->projects->create($this->convertedProjectPayload($lead, $customer, $quotation, $data['project'] ?? []));
            $contract = $this->contracts->create($this->convertedContractPayload($lead, $customer, $project, $quotation, $data['contract'] ?? []));

            if ($quotation) {
                $quotation = $this->quotations->linkWonRecords($quotation->id, $customer['id'], $project['id'], $contract['id']);
            }

            /** @var Lead $convertedLead */
            $convertedLead = $this->leads->update($lead->id, [
                'converted_customer_id' => $customer['id'],
                'closed_date' => $lead->closed_date?->toDateString() ?? now()->toDateString(),
            ]);

            $convertedLead = $this->loadLeadRelations($convertedLead);
            $this->recordTimeline($convertedLead, 'convert', $this->buildConvertedTimelineContent($convertedLead, $customer, $project, $contract, $quotation?->id));

            return [
                'lead' => $this->apiResource($this->loadLeadRelations($convertedLead), LeadResource::class),
                'customer' => $customer,
                'project' => $project,
                'contract' => $contract,
                'quotation' => $quotation ? $this->apiResource($quotation, QuotationResource::class) : null,
            ];
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->leads->delete($id);

            return ['message' => 'Xóa lead thành công'];
        });
    }

    private function normalizeFilters(array $filters): array
    {
        return $this->normalizeKeys($filters);
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        foreach (['lead_code', 'status_option_id', 'assigned_user_id', 'source_option_id', 'industry_option_id', 'interested_service_option_id', 'interested_service_id'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
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
            'statusOptionId' => 'status_option_id',
            'occurredDate' => 'occurred_date',
            'assignedUserId' => 'assigned_user_id',
            'sourceOptionId' => 'source_option_id',
            'industryOptionId' => 'industry_option_id',
            'interestedServiceOptionId' => 'interested_service_option_id',
            'interestedServiceOptionIds' => 'interested_service_option_ids',
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

    private function normalizeConvertPayload(array $data): array
    {
        if (array_key_exists('quotationId', $data)) {
            $data['quotation_id'] = $data['quotationId'];
            unset($data['quotationId']);
        }

        return $data;
    }

    private function convertedCustomerPayload(Lead $lead, array $data): array
    {
        $data = $this->normalizeKeys($data);

        return array_merge([
            'lead_id' => $lead->id,
            'customer_name' => $lead->customer_name,
            'phone' => $lead->phone,
            'website' => $lead->website,
            'industry' => $lead->industry,
            'industry_option_id' => $lead->industry_option_id,
            'source_option_id' => $lead->source_option_id,
            'sales_user_id' => $lead->assigned_user_id,
            'note' => $lead->note,
        ], $data, [
            'lead_id' => $lead->id,
        ]);
    }

    private function convertedProjectPayload(Lead $lead, array $customer, ?Quotation $quotation, array $data): array
    {
        $data = $this->normalizeProjectKeys($data);
        $serviceId = $data['service_id'] ?? $quotation?->service_id;
        $projectName = $data['project_name'] ?? $this->quotationProjectName($quotation) ?? (($customer['customerName'] ?? $lead->customer_name).' - '.($quotation?->service_name ?? 'Project'));

        if (! $serviceId) {
            throw new ConflictHttpException('Cần service_id hoặc quotation có service để tạo project');
        }

        return array_merge([
            'customer_id' => $customer['id'],
            'quotation_id' => $quotation?->id,
            'service_id' => $serviceId,
            'project_name' => ($customer['customerName'] ?? $lead->customer_name).' - '.($quotation?->service_name ?? 'Dự án'),
            'sales_user_id' => $lead->assigned_user_id,
            'note' => $lead->note,
        ], $data, [
            'customer_id' => $customer['id'],
            'quotation_id' => $quotation?->id,
            'service_id' => $serviceId,
            'project_name' => $projectName,
        ]);
    }

    private function convertedContractPayload(Lead $lead, array $customer, array $project, ?Quotation $quotation, array $data): array
    {
        $data = $this->normalizeContractKeys($data);

        return array_merge([
            'project_id' => $project['id'],
            'quotation_id' => $quotation?->id,
            'lead_id' => $lead->id,
            'customer_id' => $customer['id'],
            'contract_no' => $project['projectCode'] ?? null,
            'deposit_amount' => $quotation?->deposit_amount ?? 0,
            'signed_date' => now()->toDateString(),
            'note' => $quotation?->note ?? $lead->note,
        ], $data, [
            'project_id' => $project['id'],
            'quotation_id' => $quotation?->id,
            'lead_id' => $lead->id,
            'customer_id' => $customer['id'],
            'contract_no' => $data['contract_no'] ?? $project['projectCode'] ?? null,
        ]);
    }

    private function quotationProjectName(?Quotation $quotation): ?string
    {
        $metadata = is_array($quotation?->metadata) ? $quotation->metadata : [];
        $projectName = $metadata['projectName'] ?? null;

        return is_string($projectName) && trim($projectName) !== '' ? trim($projectName) : null;
    }

    private function normalizeProjectKeys(array $data): array
    {
        $map = [
            'projectCode' => 'project_code',
            'projectName' => 'project_name',
            'serviceId' => 'service_id',
            'managerUserId' => 'manager_user_id',
            'salesUserId' => 'sales_user_id',
            'startDate' => 'start_date',
            'endDate' => 'end_date',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function normalizeContractKeys(array $data): array
    {
        $map = [
            'contractNo' => 'contract_no',
            'contractStatusId' => 'contract_status_id',
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

    private function extractServiceOptionIds(array &$data): ?array
    {
        $hasArray = array_key_exists('interestedServiceOptionIds', $data) || array_key_exists('interested_service_option_ids', $data);
        $rawIds = $data['interestedServiceOptionIds'] ?? $data['interested_service_option_ids'] ?? [];

        unset($data['interestedServiceOptionIds'], $data['interested_service_option_ids']);

        if (! $hasArray) {
            return null;
        }

        if (! is_array($rawIds)) {
            return [];
        }

        return array_values(array_unique(array_filter($rawIds, fn ($id) => is_string($id) && $id !== '')));
    }

    private function loadLeadRelations(Lead $lead): Lead
    {
        return $lead->load(['statusOption', 'assignedUser', 'sourceOption', 'industryOption', 'interestedServiceOption', 'interestedServiceOptions', 'interestedService', 'convertedCustomer', 'timelines.createdBy']);
    }

    private function recordTimeline(Lead $lead, string $type, array $content): void
    {
        $authUser = $this->currentUser();

        CustomerTimeline::query()->create([
            'lead_id' => $lead->id,
            'type' => $type,
            'content' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_by' => $authUser?->id,
        ]);
    }

    private function buildCreatedTimelineContent(Lead $lead): array
    {
        return $this->leadTimelinePayload('create', 'Tạo lead', $lead);
    }

    private function buildUpdatedTimelineContent(Lead $lead, array $changes): array
    {
        return $this->leadTimelinePayload('update', 'Cập nhật lead', $lead, [
            'changes' => $changes,
        ]);
    }

    private function buildConvertedTimelineContent(Lead $lead, array $customer, array $project, array $contract, ?string $quotationId): array
    {
        return $this->leadTimelinePayload('convert', 'Chuyển đổi lead', $lead, [
            'quotationId' => $quotationId,
            'customer' => [
                'id' => $customer['id'] ?? null,
                'code' => $customer['customerCode'] ?? null,
                'customerName' => $customer['customerName'] ?? null,
            ],
            'project' => [
                'id' => $project['id'] ?? null,
                'code' => $project['projectCode'] ?? null,
                'name' => $project['projectName'] ?? null,
            ],
            'contract' => [
                'id' => $contract['id'] ?? null,
                'contractNo' => $contract['contractNo'] ?? null,
            ],
        ]);
    }

    private function leadTimelinePayload(string $action, string $title, Lead $lead, array $extra = []): array
    {
        $authUser = $this->currentUser();

        return array_merge([
            'action' => $action,
            'title' => $title,
            'lead' => [
                'id' => $lead->id,
                'code' => $lead->lead_code,
                'customerName' => $lead->customer_name,
            ],
            'note' => $lead->note,
            'status' => $lead->statusOption ? [
                'id' => $lead->statusOption->id,
                'key' => $lead->statusOption->key,
                'label' => $lead->statusOption->label,
            ] : null,
            'actor' => $authUser ? [
                'id' => $authUser->id,
                'code' => $authUser->code,
                'name' => $authUser->name,
            ] : null,
        ], $extra);
    }

    private function describeLeadChanges(Lead $before, Lead $after, array $submittedData): array
    {
        $fieldLabels = [
            'lead_code' => 'Mã lead',
            'customer_name' => 'Tên khách hàng',
            'status_option_id' => 'Trạng thái',
            'occurred_date' => 'Ngày phát sinh',
            'assigned_user_id' => 'Người phụ trách',
            'source_option_id' => 'Nguồn phát sinh',
            'industry_option_id' => 'Ngành nghề',
            'interested_service_option_id' => 'Dịch vụ quan tâm chính',
            'interested_service_id' => 'Dịch vụ hệ thống',
            'interested_service_text' => 'Ghi chú dịch vụ quan tâm',
            'phone' => 'Số điện thoại',
            'website' => 'Website',
            'industry' => 'Ngành nghề text',
            'plan_link' => 'Link plan',
            'zalo_group' => 'Nhóm Zalo',
            'note' => 'Note',
            'closed_date' => 'Ngày đóng',
            'converted_customer_id' => 'Khách hàng chuyển đổi',
        ];

        $changes = [];

        foreach ($fieldLabels as $field => $label) {
            if (! array_key_exists($field, $submittedData)) {
                continue;
            }

            $oldValue = $this->displayFieldValue($before, $field);
            $newValue = $this->displayFieldValue($after, $field);

            if ($oldValue === $newValue) {
                continue;
            }

            $changes[] = [
                'field' => $field,
                'label' => $label,
                'old' => $oldValue,
                'new' => $newValue,
            ];
        }

        return $changes;
    }

    private function displayFieldValue(Lead $lead, string $field): string
    {
        return match ($field) {
            'status_option_id' => $this->displayOption($lead->statusOption),
            'source_option_id' => $this->displayOption($lead->sourceOption),
            'industry_option_id' => $this->displayOption($lead->industryOption),
            'interested_service_option_id' => $this->displayOption($lead->interestedServiceOption),
            'assigned_user_id' => $lead->assignedUser?->name ?: $this->emptyValue(),
            'interested_service_id' => $lead->interestedService?->name ?: $this->emptyValue(),
            'converted_customer_id' => $lead->convertedCustomer?->customer_name ?: $this->emptyValue(),
            'occurred_date', 'closed_date' => $lead->{$field}?->toDateString() ?: $this->emptyValue(),
            default => $this->stringValue($lead->{$field}),
        };
    }

    private function displayOption(?Option $option): string
    {
        return $option?->label ?: $this->emptyValue();
    }

    private function formatOptionCollection(Collection $options): string
    {
        $labels = $options
            ->map(fn (Option $option): string => $option->label)
            ->filter()
            ->values()
            ->all();

        return $labels === [] ? $this->emptyValue() : implode(', ', $labels);
    }

    private function stringValue(mixed $value): string
    {
        if ($value === null || $value === '') {
            return $this->emptyValue();
        }

        return (string) $value;
    }

    private function emptyValue(): string
    {
        return 'Trống';
    }

    private function currentUser(): ?User
    {
        $user = request()->user();

        return $user instanceof User ? $user : null;
    }

    private function generateLeadCode(): string
    {
        $lastNumber = DB::table('leads')
            ->whereNotNull('lead_code')
            ->whereRaw("lead_code ~ '^[0-9]+$'")
            ->selectRaw('MAX(CAST(lead_code AS INTEGER)) as max_code')
            ->value('max_code');

        $nextNumber = ((int) ($lastNumber ?: 0)) + 1;

        do {
            $code = str_pad((string) $nextNumber, 3, '0', STR_PAD_LEFT);
            $nextNumber++;
        } while (DB::table('leads')->where('lead_code', $code)->exists());

        return $code;
    }

    private function defaultStatusOptionId(): int
    {
        $statusOptionId = DB::table('options')
            ->where('group', Option::GROUP_LEAD_STATUS)
            ->where('key', 'new')
            ->whereNull('deleted_at')
            ->value('id');

        if ($statusOptionId) {
            return $statusOptionId;
        }

        return DB::table('options')->insertGetId([
            'group' => Option::GROUP_LEAD_STATUS,
            'key' => 'new',
            'value' => 'new',
            'label' => 'Mới',
            'meta' => json_encode(['color' => '#3b82f6']),
            'sort_order' => 1,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
