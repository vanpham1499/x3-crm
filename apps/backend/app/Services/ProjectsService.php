<?php

namespace App\Services;

use App\Http\Resources\ProjectResource;
use App\Models\Contract;
use App\Models\CustomerTimeline;
use App\Models\Option;
use App\Models\Project;
use App\Models\User;
use App\Repositories\ProjectRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectsService extends BaseService
{
    public function __construct(
        private readonly ProjectRepository $projects,
        private readonly QuotationsService $quotations,
    ) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->projects->findAll($this->normalizeKeys($filters)), ProjectResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->projects->findWithRelationsOrFail($id), ProjectResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $contractData = $data['contract'] ?? null;
            unset($data['contract']);

            $data = $this->normalizePayload($data);
            $this->validateQuotationLink($data);
            $data['project_code'] = $data['project_code'] ?? $this->projectCodeFromQuotation($data['quotation_id'] ?? null);
            $data['project_code'] = $data['project_code'] ?? $this->generateProjectCode();
            $data['project_code'] = $this->ensureUniqueProjectCode($data['project_code']);
            $data['status_option_id'] = $data['status_option_id'] ?? $this->defaultStatusOption()->id;

            /** @var Project $project */
            $project = $this->projects->create($data);
            $project = $this->loadProjectRelations($project);
            $this->recordTimeline($project, 'create', $this->buildCreatedTimelineContent($project));
            $contract = is_array($contractData) ? $this->syncProjectContract($project, $contractData) : null;

            if ($project->quotation_id) {
                $this->quotations->linkWonRecords($project->quotation_id, $project->customer_id, $project->id, $contract?->id);
            }

            return $this->apiResource($this->loadProjectRelations($project), ProjectResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $hasContract = array_key_exists('contract', $data);
            $contractData = $data['contract'] ?? null;
            unset($data['contract']);

            $data = $this->normalizePayload($data);
            $before = $this->loadProjectRelations($this->projects->findWithRelationsOrFail($id));
            $this->validateQuotationLink($data, $before);

            /** @var Project $project */
            $project = $this->projects->update($id, $data);
            $project = $this->loadProjectRelations($project);
            $changes = $this->describeProjectChanges($before, $project, $data);

            if ($changes !== []) {
                $this->recordTimeline($project, 'update', $this->buildUpdatedTimelineContent($project, $changes));
            }

            $contract = $hasContract && is_array($contractData) ? $this->syncProjectContract($project, $contractData) : $project->contracts()->first();

            if ($project->quotation_id) {
                $this->quotations->linkWonRecords($project->quotation_id, $project->customer_id, $project->id, $contract?->id);
            }

            return $this->apiResource($this->loadProjectRelations($project), ProjectResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->projects->delete($id);

            return ['message' => 'Xóa dự án thành công'];
        });
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        if (array_key_exists('project_code', $data) && ($data['project_code'] === '' || $data['project_code'] === null)) {
            unset($data['project_code']);
        }

        foreach (['status_id', 'status_option_id', 'manager_user_id', 'sales_user_id'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'projectCode' => 'project_code',
            'customerId' => 'customer_id',
            'quotationId' => 'quotation_id',
            'serviceId' => 'service_id',
            'projectName' => 'project_name',
            'statusId' => 'status_id',
            'statusOptionId' => 'status_option_id',
            'managerUserId' => 'manager_user_id',
            'salesUserId' => 'sales_user_id',
            'zaloGroup' => 'zalo_group',
            'planLink' => 'plan_link',
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

    private function validateQuotationLink(array $data, ?Project $existingProject = null): void
    {
        $quotationId = array_key_exists('quotation_id', $data)
            ? $data['quotation_id']
            : $existingProject?->quotation_id;

        if (! $quotationId) {
            return;
        }

        $quotation = $this->quotations->findModel((string) $quotationId);
        $projectId = $existingProject?->id;
        $customerId = $data['customer_id'] ?? $existingProject?->customer_id;
        $serviceId = $data['service_id'] ?? $existingProject?->service_id;

        if ($quotation->project_id && (string) $quotation->project_id !== (string) $projectId) {
            throw ValidationException::withMessages([
                'quotationId' => ['Báo phí này đã được gắn với một dự án khác.'],
            ]);
        }

        if ($quotation->status === 'lost') {
            throw ValidationException::withMessages([
                'quotationId' => ['Không thể tạo dự án từ báo phí đã hủy.'],
            ]);
        }

        if ($quotation->customer_id && (string) $quotation->customer_id !== (string) $customerId) {
            throw ValidationException::withMessages([
                'customerId' => ['Khách hàng của dự án phải trùng với khách hàng trên báo phí.'],
            ]);
        }

        if ($quotation->service_id && (string) $quotation->service_id !== (string) $serviceId) {
            throw ValidationException::withMessages([
                'serviceId' => ['Dịch vụ của dự án phải trùng với dịch vụ trên báo phí.'],
            ]);
        }
    }

    private function loadProjectRelations(Project $project): Project
    {
        return $project->load(['customer', 'quotation', 'service', 'statusOption', 'managerUser', 'salesUser', 'contracts.contractStatus', 'contracts.contractStatusOption', 'payments', 'timelines.createdBy']);
    }

    private function syncProjectContract(Project $project, array $data): ?Contract
    {
        $data = $this->normalizeContractPayload($data);

        if (! $this->hasContractPayload($data)) {
            return null;
        }

        $contractId = $data['id'] ?? null;
        unset($data['id']);

        $data = array_merge($data, [
            'project_id' => $project->id,
            'quotation_id' => $project->quotation_id,
            'customer_id' => $project->customer_id,
            'contract_no' => $data['contract_no'] ?? $project->project_code,
        ]);

        if ($project->quotation_id) {
            $quotation = $this->quotations->findModel($project->quotation_id);
            $data['lead_id'] = $quotation->lead_id;
            $data['deposit_amount'] = $data['deposit_amount'] ?? $quotation->deposit_amount;
            $data['note'] = $data['note'] ?? $quotation->note;
        }

        if ($contractId) {
            $contract = Contract::query()
                ->where('project_id', $project->id)
                ->whereKey($contractId)
                ->first();

            if ($contract) {
                $contract->update($data);

                return $contract->refresh();
            }
        }

        return Contract::query()->create($data);
    }

    private function normalizeContractPayload(array $data): array
    {
        $map = [
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

        foreach (['contract_no', 'contract_status_id', 'deposit_amount', 'signed_date', 'expired_date', 'contract_month', 'file_url', 'note'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        return $data;
    }

    private function hasContractPayload(array $data): bool
    {
        foreach (['id', 'contract_no', 'deposit_amount', 'signed_date', 'expired_date', 'contract_month', 'file_url', 'note'] as $key) {
            if (($data[$key] ?? null) !== null && ($data[$key] ?? '') !== '') {
                return true;
            }
        }

        return false;
    }

    private function recordTimeline(Project $project, string $type, array $content): void
    {
        $authUser = $this->currentUser();

        CustomerTimeline::query()->create([
            'customer_id' => $project->customer_id,
            'project_id' => $project->id,
            'type' => $type,
            'content' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_by' => $authUser?->id,
        ]);
    }

    private function buildCreatedTimelineContent(Project $project): array
    {
        return $this->projectTimelinePayload('create', 'Tạo dự án', $project);
    }

    private function buildUpdatedTimelineContent(Project $project, array $changes): array
    {
        return $this->projectTimelinePayload('update', 'Cập nhật dự án', $project, [
            'changes' => $changes,
        ]);
    }

    private function projectTimelinePayload(string $action, string $title, Project $project, array $extra = []): array
    {
        $authUser = $this->currentUser();

        return array_merge([
            'action' => $action,
            'title' => $title,
            'project' => [
                'id' => $project->id,
                'code' => $project->project_code,
                'name' => $project->project_name,
            ],
            'customer' => $project->customer ? [
                'id' => $project->customer->id,
                'code' => $project->customer->customer_code,
                'name' => $project->customer->customer_name,
            ] : null,
            'note' => $project->note,
            'status' => $project->statusOption ? [
                'id' => $project->statusOption->id,
                'key' => $project->statusOption->key,
                'label' => $project->statusOption->label,
            ] : null,
            'actor' => $authUser ? [
                'id' => $authUser->id,
                'code' => $authUser->code,
                'name' => $authUser->name,
            ] : null,
        ], $extra);
    }

    private function describeProjectChanges(Project $before, Project $after, array $submittedData): array
    {
        $fieldLabels = [
            'project_code' => 'Mã dự án',
            'customer_id' => 'Khách hàng',
            'service_id' => 'Dịch vụ',
            'project_name' => 'Tên dự án',
            'status_option_id' => 'Trạng thái',
            'manager_user_id' => 'Nhân sự quản lý',
            'sales_user_id' => 'Nhân sự sales',
            'zalo_group' => 'Nhóm Zalo',
            'plan_link' => 'Link kế hoạch',
            'start_date' => 'Ngày bắt đầu',
            'end_date' => 'Ngày kết thúc',
            'note' => 'Note',
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

    private function displayFieldValue(Project $project, string $field): string
    {
        return match ($field) {
            'customer_id' => $project->customer?->customer_name ?: $this->emptyValue(),
            'service_id' => $project->service?->name ?: $this->emptyValue(),
            'status_option_id' => $this->displayOption($project->statusOption),
            'manager_user_id' => $project->managerUser?->name ?: $this->emptyValue(),
            'sales_user_id' => $project->salesUser?->name ?: $this->emptyValue(),
            'start_date' => $project->start_date?->toDateString() ?: $this->emptyValue(),
            'end_date' => $project->end_date?->toDateString() ?: $this->emptyValue(),
            default => $this->stringValue($project->{$field}),
        };
    }

    private function defaultStatusOption(): Option
    {
        return Option::query()->firstOrCreate(
            [
                'group' => Option::GROUP_PROJECT_STATUS,
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

    private function displayOption(?Option $option): string
    {
        return $option?->label ?: $this->emptyValue();
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

    private function generateProjectCode(): string
    {
        $lastNumber = DB::table('projects')
            ->whereNotNull('project_code')
            ->whereRaw("project_code ~ '^[0-9]+$'")
            ->selectRaw('MAX(CAST(project_code AS INTEGER)) as max_code')
            ->value('max_code');

        $nextNumber = ((int) ($lastNumber ?: 0)) + 1;

        do {
            $code = str_pad((string) $nextNumber, 3, '0', STR_PAD_LEFT);
            $nextNumber++;
        } while (DB::table('projects')->where('project_code', $code)->exists());

        return $code;
    }

    private function projectCodeFromQuotation(?string $quotationId): ?string
    {
        if (! $quotationId) {
            return null;
        }

        $quotationCode = DB::table('quotations')->where('id', $quotationId)->value('quotation_code');

        if (! $quotationCode) {
            return null;
        }

        return preg_replace('/\.Q[0-9]+$/i', '', $quotationCode) ?: $quotationCode;
    }

    private function ensureUniqueProjectCode(string $code): string
    {
        if (! DB::table('projects')->where('project_code', $code)->exists()) {
            return $code;
        }

        $baseCode = mb_substr($code, 0, 96);
        $nextNumber = 2;

        do {
            $suffix = ".{$nextNumber}";
            $candidate = mb_substr($baseCode, 0, 100 - mb_strlen($suffix)).$suffix;
            $nextNumber++;
        } while (DB::table('projects')->where('project_code', $candidate)->exists());

        return $candidate;
    }
}
