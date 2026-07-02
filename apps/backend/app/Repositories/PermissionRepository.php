<?php

namespace App\Repositories;

use App\Models\Permission;
use Illuminate\Database\Eloquent\Collection;

class PermissionRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Quyền không tồn tại';

    protected function model(): string
    {
        return Permission::class;
    }

    public function findAll(?string $module = null, ?string $keyword = null): Collection
    {
        return $this->query()
            ->when($module, fn ($query) => $query->where('module', $module))
            ->when($keyword, function ($query) use ($keyword): void {
                $query->where(function ($subQuery) use ($keyword): void {
                    $subQuery
                        ->where('code', 'ilike', "%{$keyword}%")
                        ->orWhere('name', 'ilike', "%{$keyword}%")
                        ->orWhere('description', 'ilike', "%{$keyword}%");
                });
            })
            ->orderBy('module')
            ->orderBy('code')
            ->get();
    }
}
