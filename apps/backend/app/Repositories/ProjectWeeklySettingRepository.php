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

    public function findActiveForBoard(array $filters = []): Collection
    {
        return $this->query()
            ->with(['project.customer', 'project.statusOption', 'reportOwner'])
            ->where('is_active', true)
            ->whereHas('project')
            ->when($filters['keyword'] ?? null, function ($query, string $keyword): void {
                $keyword = trim($keyword);

                $query->whereHas('project', function ($projectQuery) use ($keyword): void {
                    $projectQuery
                        ->where('project_code', 'like', "%{$keyword}%")
                        ->orWhere('project_name', 'like', "%{$keyword}%")
                        ->orWhereHas('customer', function ($customerQuery) use ($keyword): void {
                            $customerQuery
                                ->where('customer_code', 'like', "%{$keyword}%")
                                ->orWhere('customer_name', 'like', "%{$keyword}%");
                        });
                });
            })
            ->when(
                $filters['report_owner_user_id'] ?? null,
                fn ($query, $value) => $query->where('report_owner_user_id', $value),
            )
            ->when(
                $filters['report_weekday'] ?? null,
                fn ($query, $value) => $query->where('report_weekday', $value),
            )
            ->orderBy('report_weekday')
            ->orderBy('project_id')
            ->get();
    }

    public function countAssignments(
        int $reportOwnerUserId,
        int $reportWeekday,
        ?int $excludeProjectId = null,
    ): int {
        return $this->query()
            ->where('report_owner_user_id', $reportOwnerUserId)
            ->where('report_weekday', $reportWeekday)
            ->where('is_active', true)
            ->when($excludeProjectId, fn ($query) => $query->where('project_id', '!=', $excludeProjectId))
            ->whereHas('project')
            ->count();
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
