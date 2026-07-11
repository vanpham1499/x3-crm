<?php

namespace App\Services;

use App\Http\Resources\ServiceResource;
use App\Models\Service;
use App\Repositories\ServiceRepository;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class ServicesService extends BaseService
{
    public function __construct(private readonly ServiceRepository $services) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->services->findAll($filters), ServiceResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->services->findWithRelationsOrFail($id), ServiceResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizePayload($data);
            $data['level'] = $this->resolveLevel($data['parent_id'] ?? null);

            /** @var Service $service */
            $service = $this->services->create($data);

            return $this->apiResource($service->load(['parent', 'childrenRecursive']), ServiceResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $service = $this->services->findWithRelationsOrFail($id);
            $data = $this->normalizePayload($data);

            if (array_key_exists('parent_id', $data)) {
                $this->ensureParentIsValid($service, $data['parent_id']);
                $data['level'] = $this->resolveLevel($data['parent_id']);
            }

            /** @var Service $updated */
            $updated = $this->services->update($id, $data);

            if (array_key_exists('level', $data)) {
                $this->syncChildrenLevels($updated);
            }

            return $this->apiResource($updated->load(['parent', 'childrenRecursive']), ServiceResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var Service $service */
            $service = $this->services->findOrFail($id);

            if ($service->children()->exists()) {
                throw new ConflictHttpException('Không thể xóa dịch vụ đang có dịch vụ con');
            }

            if ($service->projects()->exists()) {
                throw new ConflictHttpException('Không thể xóa dịch vụ đang được gán với dự án');
            }

            if ($service->revenueItems()->exists()) {
                throw new ConflictHttpException('Không thể xóa dịch vụ đang được gán với doanh thu');
            }

            $service->delete();

            return ['message' => 'Xóa dịch vụ thành công'];
        });
    }

    private function normalizePayload(array $data): array
    {
        if (array_key_exists('isActive', $data)) {
            $data['is_active'] = $data['isActive'];
            unset($data['isActive']);
        }

        if (array_key_exists('is_active', $data) && $data['is_active'] === null) {
            unset($data['is_active']);
        }

        if (array_key_exists('parentId', $data)) {
            $data['parent_id'] = $data['parentId'];
            unset($data['parentId']);
        }

        if (array_key_exists('invoiceContent', $data)) {
            $data['invoice_content'] = $data['invoiceContent'];
            unset($data['invoiceContent']);
        }

        if (array_key_exists('invoiceTiming', $data)) {
            $data['invoice_timing'] = $data['invoiceTiming'];
            unset($data['invoiceTiming']);
        }

        if (array_key_exists('sortOrder', $data)) {
            $data['sort_order'] = $data['sortOrder'];
            unset($data['sortOrder']);
        }

        if (array_key_exists('sort_order', $data) && $data['sort_order'] === null) {
            $data['sort_order'] = 0;
        }

        if (array_key_exists('defaultPrice', $data)) {
            $data['default_price'] = $data['defaultPrice'];
            unset($data['defaultPrice']);
        }

        if (array_key_exists('default_price', $data) && $data['default_price'] === null) {
            $data['default_price'] = 0;
        }

        return $data;
    }

    private function resolveLevel(?string $parentId): int
    {
        if (! $parentId) {
            return 1;
        }

        /** @var Service $parent */
        $parent = $this->services->findOrFail($parentId);

        return $parent->level + 1;
    }

    private function ensureParentIsValid(Service $service, ?string $parentId): void
    {
        if (! $parentId) {
            return;
        }

        if ($service->id === $parentId) {
            throw new UnprocessableEntityHttpException('Dịch vụ cha không được trùng với dịch vụ hiện tại');
        }

        if (in_array($parentId, $this->services->descendantIds($service->id), true)) {
            throw new UnprocessableEntityHttpException('Dịch vụ cha không được là dịch vụ con của chính nó');
        }
    }

    private function syncChildrenLevels(Service $service): void
    {
        $service->load('children');

        foreach ($service->children as $child) {
            $child->forceFill(['level' => $service->level + 1])->save();
            $this->syncChildrenLevels($child);
        }
    }
}
