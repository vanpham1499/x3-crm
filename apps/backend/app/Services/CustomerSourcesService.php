<?php

namespace App\Services;

use App\Http\Resources\CustomerSourceResource;
use App\Models\CustomerSource;
use App\Repositories\CustomerSourceRepository;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class CustomerSourcesService extends BaseService
{
    public function __construct(private readonly CustomerSourceRepository $sources) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->sources->findAll($filters), CustomerSourceResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->sources->findOrFail($id), CustomerSourceResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            /** @var CustomerSource $source */
            $source = $this->sources->create($data);

            return $this->apiResource($source, CustomerSourceResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var CustomerSource $source */
            $source = $this->sources->update($id, $data);

            return $this->apiResource($source, CustomerSourceResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var CustomerSource $source */
            $source = $this->sources->findOrFail($id);

            if ($source->leads()->exists() || $source->customers()->exists()) {
                throw new ConflictHttpException('Khong the xoa nguon phat sinh dang duoc su dung');
            }

            $source->delete();

            return ['message' => 'Xoa nguon phat sinh thanh cong'];
        });
    }
}
