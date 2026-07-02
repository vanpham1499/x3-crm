<?php

namespace App\Repositories;

use App\Models\Role;
use Illuminate\Database\Eloquent\Collection;

class RoleRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Vai trò không tồn tại';

    protected function model(): string
    {
        return Role::class;
    }

    public function findAll(?string $keyword = null): Collection
    {
        return $this->query()
            ->with('permissions')
            ->when($keyword, function ($query) use ($keyword): void {
                $query->where(function ($subQuery) use ($keyword): void {
                    $subQuery
                        ->where('name', 'ilike', "%{$keyword}%")
                        ->orWhere('description', 'ilike', "%{$keyword}%");
                });
            })
            ->orderBy('name')
            ->get();
    }

    public function findWithPermissionsOrFail(string $id): Role
    {
        /** @var Role $role */
        $role = $this->query()->with('permissions')->whereKey($id)->first();

        if (! $role) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException($this->notFoundMessage);
        }

        return $role;
    }
}
