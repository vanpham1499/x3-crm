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
        return $this->apiCollection($this->settings->findAll($this->normalizeKeys($filters)), ProjectWeeklySettingResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->settings->findWithRelationsOrFail($id), ProjectWeeklySettingResource::class);
    }

    public function upsertForProject(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizeKeys($data);
            $existing = $this->settings->findByProject((string) $data['project_id']);

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
            /** @var ProjectWeeklySetting $setting */
            $setting = $this->settings->update($id, $this->normalizeKeys($data));

            return $this->apiResource($setting->load(['project', 'reportOwner']), ProjectWeeklySettingResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
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
}
