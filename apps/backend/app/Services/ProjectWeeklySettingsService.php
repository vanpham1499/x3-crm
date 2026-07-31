<?php

namespace App\Services;

use App\Http\Resources\ProjectWeeklySettingResource;
use App\Models\ProjectWeeklySetting;
use App\Repositories\ProjectWeeklySettingRepository;

class ProjectWeeklySettingsService extends BaseService
{
    public function __construct(private readonly ProjectWeeklySettingRepository $settings) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection(
            $this->settings->findAll($this->normalizeKeys($filters), $this->currentUser()),
            ProjectWeeklySettingResource::class,
        );
    }

    public function findOne(string $id): array
    {
        return $this->apiResource(
            $this->settings->findVisibleWithRelationsOrFail($this->currentUser(), $id),
            ProjectWeeklySettingResource::class,
        );
    }

    public function assignmentSummary(
        int $reportOwnerUserId,
        int $reportWeekday,
        ?int $excludeProjectId = null,
    ): array {
        return [
            'reportOwnerUserId' => $reportOwnerUserId,
            'reportWeekday' => $reportWeekday,
            'projectCount' => $this->settings->countAssignments(
                $reportOwnerUserId,
                $reportWeekday,
                $excludeProjectId,
            ),
        ];
    }

    public function upsertForProject(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizeKeys($data);
            $this->authorizeProjectOwnership($data['project_id'] ?? null);
            $existing = $this->settings->findByProject((string) $data['project_id']);
            $data = $this->prepareScheduleData($data, $existing);

            /** @var ProjectWeeklySetting $setting */
            $setting = $existing
                ? $this->settings->update((string) $existing->id, $data)
                : $this->settings->create($data);

            return $this->apiResource($setting->load(['project', 'reportOwner']), ProjectWeeklySettingResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $existing = $this->settings->findOrFail($id);
            $this->authorizeProjectOwnership($existing->project_id);
            $data = $this->prepareScheduleData($this->normalizeKeys($data), $existing);

            /** @var ProjectWeeklySetting $setting */
            $setting = $this->settings->update($id, $data);

            return $this->apiResource($setting->load(['project', 'reportOwner']), ProjectWeeklySettingResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $existing = $this->settings->findOrFail($id);
            $this->authorizeProjectOwnership($existing->project_id);
            $this->settings->delete($id);

            return ['message' => 'Xóa cấu hình báo cáo tuần thành công'];
        });
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'projectId' => 'project_id',
            'reportOwnerUserId' => 'report_owner_user_id',
            'reportWeekday' => 'report_weekday',
            'monthlyBudget' => 'monthly_budget',
            'managementFeeRate' => 'management_fee_rate',
            'isActive' => 'is_active',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function prepareScheduleData(
        array $data,
        ?ProjectWeeklySetting $existing = null,
    ): array {
        $hasWeekday = array_key_exists('report_weekday', $data);

        if (! $hasWeekday && ! $existing) {
            $data['report_weekday'] = null;
            $data['is_active'] = false;

            return $data;
        }

        if ($hasWeekday) {
            $weekday = $data['report_weekday'];
            $data['report_weekday'] = $weekday === null || $weekday === ''
                ? null
                : (int) $weekday;
            $data['is_active'] = $data['report_weekday']
                ? (bool) ($data['is_active'] ?? true)
                : false;
        }

        $effectiveWeekday = $data['report_weekday'] ?? $existing?->report_weekday;

        if (! in_array((int) $effectiveWeekday, [1, 2, 3, 4, 5], true)) {
            $data['report_weekday'] = null;
            $data['is_active'] = false;
        }

        return $data;
    }
}
