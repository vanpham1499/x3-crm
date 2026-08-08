<?php

namespace App\Repositories;

use App\Models\Lead;
use App\Models\Option;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class LeadRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Lead không tồn tại';

    protected function model(): string
    {
        return Lead::class;
    }

    public function findAll(array $filters = [], ?User $user = null): Collection
    {
        return $this->filteredQuery($filters, $user)->get();
    }

    public function findPaginated(array $filters, int $perPage, int $page, ?User $user = null): LengthAwarePaginator
    {
        return $this->filteredQuery($filters, $user)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    private function filteredQuery(array $filters, ?User $user = null): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $statusOptionId = $filters['status_option_id'] ?? null;
        $status = $filters['status'] ?? null;
        $assignedUserId = $filters['assigned_user_id'] ?? null;
        $sourceOptionId = $filters['source_option_id'] ?? null;
        $source = $filters['source'] ?? null;
        $industryOptionId = $filters['industry_option_id'] ?? null;
        $industry = $filters['industry_option'] ?? null;
        $interestedServiceOptionId = $filters['interested_service_option_id'] ?? null;
        $interestedServiceId = $filters['interested_service_id'] ?? null;
        $occurredFrom = $filters['occurred_from'] ?? null;
        $occurredTo = $filters['occurred_to'] ?? null;
        $closedFrom = $filters['closed_from'] ?? null;
        $closedTo = $filters['closed_to'] ?? null;

        $query = $this->query()
            ->with(['statusOption', 'assignedUser', 'createdBy', 'sourceOption', 'industryOption', 'interestedServiceOption', 'interestedServiceOptions', 'interestedService', 'convertedCustomer']);

        $this->applyViewScope($query, $user);

        return $query
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query
                        ->where('lead_code', 'ilike', "%{$keyword}%")
                        ->orWhere('customer_name', 'ilike', "%{$keyword}%")
                        ->orWhere('phone', 'ilike', "%{$keyword}%")
                        ->orWhere('website', 'ilike', "%{$keyword}%")
                        ->orWhere('industry', 'ilike', "%{$keyword}%")
                        ->orWhere('interested_service_text', 'ilike', "%{$keyword}%");
                });
            })
            ->when($statusOptionId, fn ($query) => $query->where('status_option_id', $statusOptionId))
            ->when($status, fn ($query) => $query->whereHas('statusOption', fn ($subQuery) => $subQuery->where('group', Option::GROUP_LEAD_STATUS)->where('key', $status)))
            ->when($assignedUserId, fn ($query) => $query->where('assigned_user_id', $assignedUserId))
            ->when($sourceOptionId, fn ($query) => $query->where('source_option_id', $sourceOptionId))
            ->when($source, fn ($query) => $query->whereHas('sourceOption', fn ($subQuery) => $subQuery->where('group', Option::GROUP_LEAD_SOURCE)->where('key', $source)))
            ->when($industryOptionId, fn ($query) => $query->where('industry_option_id', $industryOptionId))
            ->when($industry, fn ($query) => $query->whereHas('industryOption', fn ($subQuery) => $subQuery->where('group', Option::GROUP_INDUSTRY)->where('key', $industry)))
            ->when($interestedServiceOptionId, fn ($query) => $query->where(function ($query) use ($interestedServiceOptionId): void {
                $query
                    ->where('interested_service_option_id', $interestedServiceOptionId)
                    ->orWhereHas('interestedServiceOptions', fn ($subQuery) => $subQuery->whereKey($interestedServiceOptionId));
            }))
            ->when(! $interestedServiceOptionId && $interestedServiceId, fn ($query) => $query->where('interested_service_id', $interestedServiceId))
            ->when($occurredFrom, fn ($query) => $query->whereDate('occurred_date', '>=', $occurredFrom))
            ->when($occurredTo, fn ($query) => $query->whereDate('occurred_date', '<=', $occurredTo))
            ->when($closedFrom, fn ($query) => $query->whereDate('closed_date', '>=', $closedFrom))
            ->when($closedTo, fn ($query) => $query->whereDate('closed_date', '<=', $closedTo))
            ->orderByDesc('occurred_date')
            ->orderByDesc('created_at');
    }

    private function applyViewScope(Builder $query, ?User $user): void
    {
        if (! $user || $user->hasPermission('lead.view_all')) {
            return;
        }

        $departmentIds = $user->accessibleDepartmentIds();

        if ($user->hasPermission('lead.view_department') && $departmentIds !== []) {
            $query->whereHas('assignedUser', fn (Builder $assignedUser) => $assignedUser
                ->whereIn('department_id', $departmentIds));

            return;
        }

        if ($user->hasPermission('lead.view')) {
            $query->where('assigned_user_id', $user->id);

            return;
        }

        $query->whereRaw('1 = 0');
    }

    public function findWithRelationsOrFail(string $id): Lead
    {
        /** @var Lead|null $lead */
        $lead = $this->query()
            ->with(['statusOption', 'assignedUser', 'createdBy', 'sourceOption', 'industryOption', 'interestedServiceOption', 'interestedServiceOptions', 'interestedService', 'convertedCustomer', 'timelines.createdBy'])
            ->whereKey($id)
            ->first();

        if (! $lead) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $lead;
    }

    public function existsByCode(string $code): bool
    {
        return $this->query()->where('lead_code', $code)->exists();
    }
}
