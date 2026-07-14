<?php

namespace App\Repositories;

use App\Models\KpiPoint;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class KpiPointRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Điểm KPI không tồn tại';

    protected function model(): string
    {
        return KpiPoint::class;
    }

    public function findAll(array $filters = []): Collection
    {
        return $this->filteredQuery($filters)
            ->with(['user', 'approver', 'categoryOption'])
            ->orderByDesc('entry_date')
            ->orderByDesc('created_at')
            ->get();
    }

    public function findPaginated(array $filters, int $perPage, int $page): LengthAwarePaginator
    {
        return $this->filteredQuery($filters)
            ->with(['user', 'approver', 'categoryOption'])
            ->orderByDesc('entry_date')
            ->orderByDesc('created_at')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function summarizeByUser(array $filters): Collection
    {
        return $this->filteredQuery($filters)
            ->selectRaw('user_id, SUM(score) as total_score, COUNT(*) as point_count')
            ->groupBy('user_id')
            ->with('user:id,name')
            ->orderByDesc('total_score')
            ->get();
    }

    private function filteredQuery(array $filters): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));

        return $this->query()
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('customer_ref', 'ilike', "%{$keyword}%")
                    ->orWhere('note', 'ilike', "%{$keyword}%");
            }))
            ->when($filters['user_id'] ?? null, fn ($query, $value) => $query->where('user_id', $value))
            ->when($filters['category'] ?? null, fn ($query, $value) => $query->where('category', $value))
            ->when($filters['type'] ?? null, fn ($query, $value) => $query->where('type', $value))
            ->when(array_key_exists('is_approved', $filters) && $filters['is_approved'] !== null, fn ($query) => $query->where('is_approved', (bool) $filters['is_approved']))
            ->when($filters['date_from'] ?? null, fn ($query, $value) => $query->whereDate('entry_date', '>=', $value))
            ->when($filters['date_to'] ?? null, fn ($query, $value) => $query->whereDate('entry_date', '<=', $value));
    }

    public function findWithRelationsOrFail(string $id): KpiPoint
    {
        /** @var KpiPoint|null $point */
        $point = $this->query()
            ->with(['user', 'approver', 'categoryOption'])
            ->whereKey($id)
            ->first();

        if (! $point) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $point;
    }
}
