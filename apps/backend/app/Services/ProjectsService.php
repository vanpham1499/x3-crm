<?php

namespace App\Services;

use App\Http\Resources\ProjectResource;
use App\Models\CustomerTimeline;
use App\Models\Option;
use App\Models\Project;
use App\Models\User;
use App\Repositories\ProjectRepository;
use Illuminate\Support\Facades\DB;

class ProjectsService extends BaseService
{
    public function __construct(private readonly ProjectRepository $projects) {}

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
            $data = $this->normalizePayload($data);
            $data['project_code'] = $data['project_code'] ?? $this->generateProjectCode();
            $data['project_code'] = $this->ensureUniqueProjectCode($data['project_code']);
            $data['status_option_id'] = $data['status_option_id'] ?? $this->defaultStatusOption()->id;

            /** @var Project $project */
            $project = $this->projects->create($data);
            $project = $this->loadProjectRelations($project);
            $this->recordTimeline($project, 'create', $this->buildCreatedTimelineContent($project));

            return $this->apiResource($this->loadProjectRelations($project), ProjectResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $data = $this->normalizePayload($data);
            $before = $this->loadProjectRelations($this->projects->findWithRelationsOrFail($id));

            /** @var Project $project */
            $project = $this->projects->update($id, $data);
            $project = $this->loadProjectRelations($project);
            $changes = $this->describeProjectChanges($before, $project, $data);

            if ($changes !== []) {
                $this->recordTimeline($project, 'update', $this->buildUpdatedTimelineContent($project, $changes));
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

    private function loadProjectRelations(Project $project): Project
    {
        return $project->load(['customer', 'service', 'statusOption', 'managerUser', 'salesUser', 'timelines.createdBy']);
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
        $user = request()->attributes->get('auth_user');

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
