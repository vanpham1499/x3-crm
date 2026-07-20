<?php

namespace App\Services;

use App\Http\Resources\ProjectResource;
use App\Models\Contract;
use App\Models\Customer;
use App\Models\CustomerTimeline;
use App\Models\Option;
use App\Models\Project;
use App\Models\ProjectWeeklySetting;
use App\Repositories\ProjectRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        return $this->apiPaginatedCollection(
            $this->projects->findPaginated($this->normalizeKeys($filters), $perPage, $page),
            ProjectResource::class,
        );
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->projects->findWithRelationsOrFail($id), ProjectResource::class);
    }

    public function create(array $data, bool $checkAuthorization = true): array
    {
        return $this->transaction(function () use ($data, $checkAuthorization): array {
            $contractData = $data['contract'] ?? null;
            unset($data['contract']);

            $data = $this->normalizePayload($data);

            if ($checkAuthorization) {
                $this->authorize('create', [
                    Project::class,
                    ! empty($data['customer_id']) ? Customer::query()->find($data['customer_id']) : null,
                ]);
            }

            $hasReportWeekday = array_key_exists('report_weekday', $data);
            $reportWeekday = $hasReportWeekday ? (int) $data['report_weekday'] : null;
            unset($data['report_weekday']);
            unset($data['project_code']);
            $this->validateQuotationLink($data);
            $data['project_type'] = $data['project_type'] ?? 'K';
            $data['start_date'] = $data['start_date'] ?? now()->toDateString();
            $data['project_code'] = $this->buildProjectCode($data) ?? $this->generateProjectCode();
            $data['project_code'] = $this->ensureUniqueProjectCode($data['project_code']);
            $data['status_option_id'] = $data['status_option_id'] ?? $this->defaultStatusOption()->id;

            /** @var Project $project */
            $project = $this->projects->create($data);
            $this->syncWeeklySetting($project, $reportWeekday, $hasReportWeekday);
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
            $hasReportWeekday = array_key_exists('report_weekday', $data);
            $reportWeekday = $hasReportWeekday ? (int) $data['report_weekday'] : null;
            unset($data['report_weekday']);
            $shouldSyncWeeklySetting = $hasReportWeekday || array_key_exists('sales_user_id', $data);
            unset($data['project_code']);
            $before = $this->loadProjectRelations($this->projects->findWithRelationsOrFail($id));
            $this->authorize('update', $before);
            $this->validateQuotationLink($data, $before);
            $codeData = [
                'customer_id' => $data['customer_id'] ?? $before->customer_id,
                'service_id' => $data['service_id'] ?? $before->service_id,
                'project_type' => $data['project_type'] ?? $before->project_type ?? 'K',
                'project_name' => $data['project_name'] ?? $before->project_name,
            ];
            $nextProjectCode = $this->buildProjectCode($codeData);

            if ($nextProjectCode) {
                $data['project_code'] = $this->ensureUniqueProjectCode($nextProjectCode, $before->id);
            }

            /** @var Project $project */
            $project = $this->projects->update($id, $data);
            if ($shouldSyncWeeklySetting) {
                $this->syncWeeklySetting($project, $reportWeekday, $hasReportWeekday);
            }
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
            $this->authorize('delete', $this->projects->findOrFail($id));
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
            'projectType' => 'project_type',
            'statusId' => 'status_id',
            'statusOptionId' => 'status_option_id',
            'managerUserId' => 'manager_user_id',
            'salesUserId' => 'sales_user_id',
            'reportWeekday' => 'report_weekday',
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
        return $project->load(['customer', 'quotation', 'service', 'statusOption', 'managerUser', 'salesUser', 'createdBy', 'weeklySetting.reportOwner', 'contracts.contractStatus', 'contracts.contractStatusOption', 'payments', 'timelines.createdBy']);
    }

    private function syncWeeklySetting(
        Project $project,
        ?int $reportWeekday,
        bool $hasReportWeekday,
    ): void {
        $setting = ProjectWeeklySetting::withTrashed()
            ->where('project_id', $project->id)
            ->first();
        $effectiveWeekday = $hasReportWeekday ? $reportWeekday : $setting?->report_weekday;

        if (! $project->sales_user_id || ! $effectiveWeekday) {
            if ($setting && ! $setting->trashed()) {
                $setting->update([
                    'is_active' => false,
                    'updated_by' => $this->currentUser()?->id,
                ]);
            }

            return;
        }

        $values = [
            'report_owner_user_id' => $project->sales_user_id,
            'report_weekday' => $effectiveWeekday,
            'is_active' => true,
            'updated_by' => $this->currentUser()?->id,
            'deleted_by' => null,
        ];

        if ($setting) {
            if ($setting->trashed()) {
                $setting->restore();
            }

            $setting->fill($values)->save();

            return;
        }

        ProjectWeeklySetting::query()->create(array_merge($values, [
            'project_id' => $project->id,
            'monthly_budget' => 0,
            'management_fee_rate' => 0,
            'created_by' => $this->currentUser()?->id,
        ]));
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
            'project_type' => 'Type dự án',
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

    private function buildProjectCode(array $data): ?string
    {
        $customerCode = ! empty($data['customer_id'])
            ? DB::table('customers')
                ->where('id', $data['customer_id'])
                ->whereNull('deleted_at')
                ->value('customer_code')
            : null;
        $serviceCode = $this->rootServiceCode($data['service_id'] ?? null);
        $projectType = $data['project_type'] ?? null;
        $projectName = $data['project_name'] ?? null;

        if (! $customerCode || ! $serviceCode || ! in_array($projectType, ['K', 'M'], true) || ! is_string($projectName) || trim($projectName) === '') {
            return null;
        }

        $code = collect([$customerCode, $serviceCode, $projectType, $projectName])
            ->map(fn (string $part): string => $this->normalizeCodeSegment($part))
            ->filter()
            ->join('.');

        return $code !== '' ? mb_substr($code, 0, 100) : null;
    }

    private function rootServiceCode(mixed $serviceId): ?string
    {
        if (! $serviceId) {
            return null;
        }

        $service = DB::table('services')
            ->where('id', $serviceId)
            ->whereNull('deleted_at')
            ->first(['id', 'parent_id', 'code']);

        while ($service && $service->parent_id) {
            $parent = DB::table('services')
                ->where('id', $service->parent_id)
                ->whereNull('deleted_at')
                ->first(['id', 'parent_id', 'code']);

            if (! $parent) {
                break;
            }

            $service = $parent;
        }

        return $service?->code;
    }

    private function normalizeCodeSegment(string $value): string
    {
        $value = Str::ascii(trim($value));
        $value = preg_replace('/\s+/', '', $value) ?: '';
        $value = preg_replace('/[^A-Za-z0-9._-]/', '', $value) ?: '';

        return Str::upper($value);
    }

    private function ensureUniqueProjectCode(string $code, int|string|null $exceptProjectId = null): string
    {
        $exists = fn (string $candidate): bool => DB::table('projects')
            ->where('project_code', $candidate)
            ->when($exceptProjectId, fn ($query) => $query->where('id', '!=', $exceptProjectId))
            ->exists();

        if (! $exists($code)) {
            return $code;
        }

        $baseCode = mb_substr($code, 0, 96);
        $nextNumber = 2;

        do {
            $suffix = ".{$nextNumber}";
            $candidate = mb_substr($baseCode, 0, 100 - mb_strlen($suffix)).$suffix;
            $nextNumber++;
        } while ($exists($candidate));

        return $candidate;
    }
}
