<?php

namespace App\Repositories;

use App\Models\Service;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ServiceRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Dich vu khong ton tai';

    protected function model(): string
    {
        return Service::class;
    }

    public function findAll(array $filters = []): Collection
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $parentId = $filters['parent_id'] ?? null;
        $level = $filters['level'] ?? null;
        $isActive = $filters['is_active'] ?? null;
        $tree = filter_var($filters['tree'] ?? false, FILTER_VALIDATE_BOOLEAN);

        return $this->query()
            ->with($tree ? ['childrenRecursive'] : ['parent'])
            ->when($tree, fn ($query) => $query->whereNull('parent_id'))
            ->when(! $tree && array_key_exists('parent_id', $filters), function ($query) use ($parentId): void {
                $parentId === null || $parentId === ''
                    ? $query->whereNull('parent_id')
                    : $query->where('parent_id', $parentId);
            })
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query
                        ->where('code', 'ilike', "%{$keyword}%")
                        ->orWhere('name', 'ilike', "%{$keyword}%")
                        ->orWhere('content', 'ilike', "%{$keyword}%")
                        ->orWhere('invoice_content', 'ilike', "%{$keyword}%");
                });
            })
            ->when($level !== null && $level !== '', fn ($query) => $query->where('level', (int) $level))
            ->when($isActive !== null && $isActive !== '', function ($query) use ($isActive): void {
                $query->where('is_active', filter_var($isActive, FILTER_VALIDATE_BOOLEAN));
            })
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Service
    {
        /** @var Service|null $service */
        $service = $this->query()
            ->with(['parent', 'childrenRecursive'])
            ->whereKey($id)
            ->first();

        if (! $service) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $service;
    }

    public function descendantIds(string $id): array
    {
        $ids = [];
        $queue = [$id];

        while ($queue !== []) {
            $children = $this->query()
                ->whereIn('parent_id', $queue)
                ->pluck('id')
                ->all();

            $queue = array_values(array_diff($children, $ids));
            $ids = array_values(array_unique(array_merge($ids, $children)));
        }

        return $ids;
    }
}
