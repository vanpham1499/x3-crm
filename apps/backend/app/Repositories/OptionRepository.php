<?php

namespace App\Repositories;

use App\Models\Option;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class OptionRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Option khong ton tai';

    protected function model(): string
    {
        return Option::class;
    }

    public function findAll(array $filters = []): Collection
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $group = $filters['group'] ?? null;
        $groups = $this->normalizeGroups($filters['groups'] ?? null);
        $isActive = $filters['is_active'] ?? null;

        return $this->query()
            ->when($group, fn ($query) => $query->where('group', $group))
            ->when(! $group && $groups !== [], fn ($query) => $query->whereIn('group', $groups))
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query
                        ->where('key', 'ilike', "%{$keyword}%")
                        ->orWhere('value', 'ilike', "%{$keyword}%")
                        ->orWhere('label', 'ilike', "%{$keyword}%");
                });
            })
            ->when($isActive !== null && $isActive !== '', function ($query) use ($isActive): void {
                $query->where('is_active', filter_var($isActive, FILTER_VALIDATE_BOOLEAN));
            })
            ->orderBy('group')
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get();
    }

    private function normalizeGroups(mixed $groups): array
    {
        if (is_string($groups)) {
            $groups = explode(',', $groups);
        }

        if (! is_array($groups)) {
            return [];
        }

        return array_values(array_filter(array_map(
            fn ($group) => trim((string) $group),
            $groups,
        )));
    }

    public function findByGroupAndKey(string $group, string $key): ?Option
    {
        /** @var Option|null $option */
        $option = $this->query()
            ->where('group', $group)
            ->where('key', $key)
            ->first();

        return $option;
    }

    public function findWithRelationsOrFail(string $id): Option
    {
        /** @var Option|null $option */
        $option = $this->query()->whereKey($id)->first();

        if (! $option) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $option;
    }
}
