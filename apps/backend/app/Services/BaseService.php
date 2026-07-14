<?php

namespace App\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

abstract class BaseService
{
    protected function transaction(callable $callback): mixed
    {
        return DB::transaction($callback);
    }

    protected function apiResource($record, ?string $resourceClass = null): array
    {
        if ($resourceClass && is_subclass_of($resourceClass, JsonResource::class)) {
            return (new $resourceClass($record))->resolve();
        }

        return $record->toArray();
    }

    protected function apiCollection($records, ?string $resourceClass = null)
    {
        return $records
            ->map(fn ($record) => $this->apiResource($record, $resourceClass))
            ->values();
    }

    protected function apiPaginatedCollection(
        LengthAwarePaginator $paginator,
        ?string $resourceClass = null,
    ): array {
        return [
            'data' => $this->apiCollection($paginator->getCollection(), $resourceClass),
            'meta' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }
}
