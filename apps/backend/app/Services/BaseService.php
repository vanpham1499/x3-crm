<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

abstract class BaseService
{
    protected function transaction(callable $callback): mixed
    {
        return DB::transaction($callback);
    }

    protected function currentUser(): ?User
    {
        return request()->user();
    }

    /**
     * Authorize an ability against a Policy for the current user.
     * Throws Illuminate\Auth\Access\AuthorizationException (rendered as 403) when denied.
     */
    protected function authorize(string $ability, mixed $arguments = []): void
    {
        Gate::forUser($this->currentUser())->authorize($ability, $arguments);
    }

    /**
     * Shared helper for project sub-resources (contracts, project costs, weekly settings, ...):
     * only the project's manager/sales owner (or admin/leader) may write to records under it.
     */
    protected function authorizeProjectOwnership(?int $projectId): void
    {
        if (! $projectId) {
            return;
        }

        $project = Project::query()->find($projectId);

        if ($project) {
            $this->authorize('update', $project);
        }
    }

    /**
     * Reconciliation/settlement-style actions (payment allocation, project cost
     * reconciliation, invoice settling, ...) are restricted to accounting staff.
     */
    protected function authorizeAccounting(): void
    {
        $user = $this->currentUser();

        if (! $user || ! $user->hasPermission('payment.manage')) {
            throw new \Illuminate\Auth\Access\AuthorizationException('Chỉ kế toán mới có quyền thực hiện thao tác này.');
        }
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
