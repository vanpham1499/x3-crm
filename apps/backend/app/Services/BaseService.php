<?php

namespace App\Services;

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
}
