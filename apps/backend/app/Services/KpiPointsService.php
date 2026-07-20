<?php

namespace App\Services;

use App\Http\Resources\KpiPointResource;
use App\Models\KpiPoint;
use App\Models\Option;
use App\Repositories\KpiPointRepository;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class KpiPointsService extends BaseService
{
    public function __construct(private readonly KpiPointRepository $points) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->points->findAll($this->normalizeFilters($filters)), KpiPointResource::class);
    }

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        $filters = $this->normalizeFilters($filters);
        $result = $this->apiPaginatedCollection(
            $this->points->findPaginated($filters, $perPage, $page),
            KpiPointResource::class,
        );
        $summary = $this->points
            ->summarizeByUser($filters)
            ->map(fn (KpiPoint $point): array => [
                'userId' => (int) $point->user_id,
                'code' => $point->user?->code,
                'name' => $point->user?->name ?: 'NV #'.$point->user_id,
                'bonusScore' => (float) $point->bonus_score,
                'penaltyScore' => (float) $point->penalty_score,
                'total' => (float) $point->total_score,
                'count' => (int) $point->point_count,
                'pendingCount' => (int) $point->pending_count,
            ])
            ->values();

        $result['meta']['summary'] = $summary->all();
        $result['meta']['overview'] = [
            'bonusScore' => (float) $summary->sum('bonusScore'),
            'penaltyScore' => (float) $summary->sum('penaltyScore'),
            'netScore' => (float) $summary->sum('total'),
            'pendingCount' => (int) $summary->sum('pendingCount'),
        ];

        return $result;
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->points->findWithRelationsOrFail($id), KpiPointResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->preparePayload($data);
            $this->authorize('create', [KpiPoint::class, $data['project_id'] ?? null]);
            $data['created_by'] = $this->currentUser()?->id;

            /** @var KpiPoint $point */
            $point = $this->points->create($data);

            return $this->apiResource($point->load(['user', 'project', 'approver']), KpiPointResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $data = $this->preparePayload($data);
            $data['updated_by'] = $this->currentUser()?->id;

            /** @var KpiPoint $point */
            $point = $this->points->update($id, $data);

            return $this->apiResource($point->load(['user', 'project', 'approver']), KpiPointResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->points->delete($id);

            return ['message' => 'Xóa điểm KPI thành công'];
        });
    }

    public function approve(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->authorize('approve', $this->points->findWithRelationsOrFail($id));

            /** @var KpiPoint $point */
            $point = $this->points->update($id, [
                'is_approved' => true,
                'approved_by' => $this->currentUser()?->id,
                'approved_at' => now(),
            ]);

            return $this->apiResource($point->load(['user', 'project', 'approver']), KpiPointResource::class);
        });
    }

    private function preparePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        if (array_key_exists('category', $data)) {
            $option = Option::query()
                ->where('group', Option::GROUP_KPI_CATEGORY)
                ->where('key', $data['category'])
                ->first();

            if (! $option || empty($option->meta['type'])) {
                throw new UnprocessableEntityHttpException('Hạng mục KPI không hợp lệ');
            }

            $data['type'] = $option->meta['type'];
        }

        return $data;
    }

    private function normalizeFilters(array $filters): array
    {
        return $this->normalizeKeys($filters);
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'userId' => 'user_id',
            'projectId' => 'project_id',
            'entryDate' => 'entry_date',
            'customerRef' => 'customer_ref',
            'isApproved' => 'is_approved',
            'dateFrom' => 'date_from',
            'dateTo' => 'date_to',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }
}
