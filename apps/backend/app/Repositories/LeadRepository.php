<?php

namespace App\Repositories;

use App\Models\Lead;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class LeadRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Lead khong ton tai';

    protected function model(): string
    {
        return Lead::class;
    }

    public function findAll(array $filters = []): Collection
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $statusId = $filters['status_id'] ?? null;
        $assignedUserId = $filters['assigned_user_id'] ?? null;
        $sourceId = $filters['source_id'] ?? null;
        $interestedServiceId = $filters['interested_service_id'] ?? null;
        $occurredFrom = $filters['occurred_from'] ?? null;
        $occurredTo = $filters['occurred_to'] ?? null;
        $closedFrom = $filters['closed_from'] ?? null;
        $closedTo = $filters['closed_to'] ?? null;

        return $this->query()
            ->with(['status', 'assignedUser', 'source', 'interestedService'])
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
            ->when($statusId, fn ($query) => $query->where('status_id', $statusId))
            ->when($assignedUserId, fn ($query) => $query->where('assigned_user_id', $assignedUserId))
            ->when($sourceId, fn ($query) => $query->where('source_id', $sourceId))
            ->when($interestedServiceId, fn ($query) => $query->where('interested_service_id', $interestedServiceId))
            ->when($occurredFrom, fn ($query) => $query->whereDate('occurred_date', '>=', $occurredFrom))
            ->when($occurredTo, fn ($query) => $query->whereDate('occurred_date', '<=', $occurredTo))
            ->when($closedFrom, fn ($query) => $query->whereDate('closed_date', '>=', $closedFrom))
            ->when($closedTo, fn ($query) => $query->whereDate('closed_date', '<=', $closedTo))
            ->orderByDesc('occurred_date')
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Lead
    {
        /** @var Lead|null $lead */
        $lead = $this->query()
            ->with(['status', 'assignedUser', 'source', 'interestedService', 'convertedCustomer', 'timelines'])
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
