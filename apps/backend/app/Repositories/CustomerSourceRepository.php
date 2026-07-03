<?php

namespace App\Repositories;

use App\Models\CustomerSource;
use Illuminate\Database\Eloquent\Collection;

class CustomerSourceRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Nguon phat sinh khong ton tai';

    protected function model(): string
    {
        return CustomerSource::class;
    }

    public function findAll(array $filters = []): Collection
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));

        return $this->query()
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where('name', 'ilike', "%{$keyword}%");
            })
            ->orderBy('name')
            ->get();
    }
}
