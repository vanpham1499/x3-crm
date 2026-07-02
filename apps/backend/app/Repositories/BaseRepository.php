<?php

namespace App\Repositories;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

abstract class BaseRepository
{
    protected string $notFoundMessage = 'Dữ liệu không tồn tại';

    abstract protected function model(): string;

    protected function modelInstance(): Model
    {
        /** @var Model $model */
        return app($this->model());
    }

    protected function query(): Builder
    {
        return $this->modelInstance()->newQuery();
    }

    public function all(): Collection
    {
        return $this->query()->get();
    }

    public function find(string $id): ?Model
    {
        return $this->query()->whereKey($id)->first();
    }

    public function findOrFail(string $id): Model
    {
        $record = $this->find($id);

        if (! $record) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $record;
    }

    public function create(array $data): Model
    {
        return $this->query()->create($data);
    }

    public function firstWhere(string $column, mixed $value): ?Model
    {
        return $this->query()->where($column, $value)->first();
    }

    public function exists(array $where): bool
    {
        return $this->query()->where($where)->exists();
    }

    public function paginate(int $perPage = 15, array $columns = ['*']): LengthAwarePaginator
    {
        return $this->query()->paginate($perPage, $columns);
    }

    public function update(string $id, array $data): Model
    {
        $record = $this->findOrFail($id);
        $record->fill($data)->save();

        return $record->refresh();
    }

    public function updateOrCreate(array $attributes, array $values = []): Model
    {
        return $this->query()->updateOrCreate($attributes, $values);
    }

    public function delete(string $id): bool
    {
        return (bool) $this->findOrFail($id)->delete();
    }
}
