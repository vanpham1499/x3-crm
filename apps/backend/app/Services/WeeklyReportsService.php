<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectWeeklySetting;
use App\Models\User;
use App\Models\WeeklyReport;
use App\Http\Resources\WeeklyReportResource;
use App\Repositories\WeeklyReportRepository;

class WeeklyReportsService extends BaseService
{
    public function __construct(private readonly WeeklyReportRepository $reports) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->reports->findAll($this->normalizeKeys($filters)), WeeklyReportResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->reports->findWithRelationsOrFail($id), WeeklyReportResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $items = $data['items'] ?? [];
            unset($data['items']);

            $data = $this->preparePayload($data);
            $data['status'] = $data['status'] ?? WeeklyReport::STATUS_DRAFT;
            $data['created_by'] = $this->currentUser()?->id;

            /** @var WeeklyReport $report */
            $report = $this->reports->create($data);
            $this->syncItems($report, $items);

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'items.assignee', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $hasItems = array_key_exists('items', $data);
            $items = $data['items'] ?? [];
            unset($data['items']);

            $data = $this->preparePayload($data);
            $data['updated_by'] = $this->currentUser()?->id;

            /** @var WeeklyReport $report */
            $report = $this->reports->update($id, $data);

            if ($hasItems) {
                $this->syncItems($report, $items);
            }

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'items.assignee', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->reports->delete($id);

            return ['message' => 'Xóa báo cáo tuần thành công'];
        });
    }

    public function submit(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var WeeklyReport $report */
            $report = $this->reports->update($id, [
                'status' => WeeklyReport::STATUS_SUBMITTED,
                'submitted_at' => now(),
                'updated_by' => $this->currentUser()?->id,
            ]);

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'items.assignee', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    public function approve(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var WeeklyReport $report */
            $report = $this->reports->update($id, [
                'status' => WeeklyReport::STATUS_APPROVED,
                'approved_by' => $this->currentUser()?->id,
                'approved_at' => now(),
            ]);

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'items.assignee', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    private function preparePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        if (! empty($data['project_id'])) {
            /** @var Project|null $project */
            $project = Project::query()->find($data['project_id']);

            if ($project) {
                $data['customer_id'] = $data['customer_id'] ?? $project->customer_id;
            }

            /** @var ProjectWeeklySetting|null $setting */
            $setting = ProjectWeeklySetting::query()->where('project_id', $data['project_id'])->first();

            if ($setting) {
                $data['monthly_budget'] = $data['monthly_budget'] ?? $setting->monthly_budget;
                $data['management_fee_rate'] = $data['management_fee_rate'] ?? $setting->management_fee_rate;
            }
        }

        $data['reporter_user_id'] = $data['reporter_user_id'] ?? $this->currentUser()?->id;
        $data['report_date'] = $data['report_date'] ?? now()->toDateString();

        return $data;
    }

    private function syncItems(WeeklyReport $report, array $items): void
    {
        $report->items()->delete();

        foreach ($items as $item) {
            $report->items()->create($this->normalizeItemKeys($item));
        }
    }

    private function normalizeItemKeys(array $item): array
    {
        $map = [
            'itemType' => 'item_type',
            'dueDate' => 'due_date',
            'assigneeUserId' => 'assignee_user_id',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $item)) {
                $item[$to] = $item[$from];
                unset($item[$from]);
            }
        }

        return $item;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'projectId' => 'project_id',
            'customerId' => 'customer_id',
            'reporterUserId' => 'reporter_user_id',
            'weekStartDate' => 'week_start_date',
            'weekEndDate' => 'week_end_date',
            'reportDate' => 'report_date',
            'projectStatus' => 'project_status',
            'weeklyCondition' => 'weekly_condition',
            'monthlyBudget' => 'monthly_budget',
            'managementFeeRate' => 'management_fee_rate',
            'problemSolution' => 'problem_solution',
            'nextAction' => 'next_action',
            'dateFrom' => 'date_from',
            'dateTo' => 'date_to',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function currentUser(): ?User
    {
        $user = request()->attributes->get('auth_user');

        return $user instanceof User ? $user : null;
    }
}
