<?php

namespace App\Repositories;

use App\Models\ProjectWeeklySetting;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectWeeklySettingRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Cấu hình báo cáo tuần không tồn tại';

    protected function model(): string
    {
        return ProjectWeeklySetting::class;
    }

    public function findAll(array $filters = []): Collection
    {
        return $this->query()
            ->with(['project', 'reportOwner'])
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['report_owner_user_id'] ?? null, fn ($query, $value) => $query->where('report_owner_user_id', $value))
            ->when(array_key_exists('is_active', $filters) && $filters['is_active'] !== null, fn ($query) => $query->where('is_active', (bool) $filters['is_active']))
            ->orderBy('report_weekday')
            ->get();
    }

    public function findByProject(string $projectId): ?ProjectWeeklySetting
    {
        return $this->query()
            ->with(['project', 'reportOwner'])
            ->where('project_id', $projectId)
            ->first();
    }

    public function findWithRelationsOrFail(string $id): ProjectWeeklySetting
    {
        /** @var ProjectWeeklySetting|null $setting */
        $setting = $this->query()
            ->with(['project', 'reportOwner'])
            ->whereKey($id)
            ->first();

        if (! $setting) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $setting;
    }
}
