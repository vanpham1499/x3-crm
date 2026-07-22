<?php

namespace App\Repositories;

use App\Models\Department;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DepartmentRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Phòng ban không tồn tại';

    protected function model(): string
    {
        return Department::class;
    }

    public function findAll(?string $keyword = null): Collection
    {
        $keyword = trim((string) $keyword);

        return $this->query()
            ->with(['leader', 'users'])
            ->withCount('users')
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query
                        ->where('name', 'ilike', "%{$keyword}%")
                        ->orWhereHas('leader', function ($leaderQuery) use ($keyword): void {
                            $leaderQuery
                                ->where('name', 'ilike', "%{$keyword}%")
                                ->orWhere('code', 'ilike', "%{$keyword}%");
                        })
                        ->orWhereHas('users', function ($userQuery) use ($keyword): void {
                            $userQuery
                                ->where('name', 'ilike', "%{$keyword}%")
                                ->orWhere('code', 'ilike', "%{$keyword}%");
                        });
                });
            })
            ->orderBy('name')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Department
    {
        /** @var Department|null $department */
        $department = $this->query()
            ->with(['leader', 'users'])
            ->withCount('users')
            ->whereKey($id)
            ->first();

        if (! $department) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $department;
    }
}
