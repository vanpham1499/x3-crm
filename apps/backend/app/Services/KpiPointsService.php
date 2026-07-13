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

    public function findOne(string $id): array
    {
        return $this->apiResource($this->points->findWithRelationsOrFail($id), KpiPointResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->preparePayload($data);
            $data['created_by'] = $this->currentUser()?->id;

            /** @var KpiPoint $point */
            $point = $this->points->create($data);

            return $this->apiResource($point->load(['user', 'approver']), KpiPointResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $data = $this->preparePayload($data);
            $data['updated_by'] = $this->currentUser()?->id;

            /** @var KpiPoint $point */
            $point = $this->points->update($id, $data);

            return $this->apiResource($point->load(['user', 'approver']), KpiPointResource::class);
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
            /** @var KpiPoint $point */
            $point = $this->points->update($id, [
                'is_approved' => true,
                'approved_by' => $this->currentUser()?->id,
                'approved_at' => now(),
            ]);

            return $this->apiResource($point->load(['user', 'approver']), KpiPointResource::class);
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

    private function currentUser(): ?\App\Models\User
    {
        return request()->user();
    }
}
