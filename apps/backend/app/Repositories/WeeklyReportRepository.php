<?php

namespace App\Repositories;

use App\Models\WeeklyReport;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class WeeklyReportRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Báo cáo tuần không tồn tại';

    protected function model(): string
    {
        return WeeklyReport::class;
    }

    public function findAll(array $filters = []): Collection
    {
        return $this->query()
            ->with(['project', 'customer', 'reporter', 'approver'])
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['reporter_user_id'] ?? null, fn ($query, $value) => $query->where('reporter_user_id', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->when($filters['week_start_date'] ?? null, fn ($query, $value) => $query->whereDate('week_start_date', $value))
            ->when($filters['date_from'] ?? null, fn ($query, $value) => $query->whereDate('week_start_date', '>=', $value))
            ->when($filters['date_to'] ?? null, fn ($query, $value) => $query->whereDate('week_end_date', '<=', $value))
            ->orderByDesc('week_start_date')
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): WeeklyReport
    {
        /** @var WeeklyReport|null $report */
        $report = $this->query()
            ->with(['project', 'customer', 'reporter', 'approver', 'items.assignee', 'attachments.uploadedBy'])
            ->whereKey($id)
            ->first();

        if (! $report) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $report;
    }
}
