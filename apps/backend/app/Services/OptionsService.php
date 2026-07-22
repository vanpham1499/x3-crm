<?php

namespace App\Services;

use App\Http\Resources\OptionResource;
use App\Models\Option;
use App\Repositories\OptionRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class OptionsService extends BaseService
{
    public function __construct(private readonly OptionRepository $options) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->options->findAll($this->normalizeKeys($filters)), OptionResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->options->findWithRelationsOrFail($id), OptionResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizePayload($data);
            $data['key'] = $data['key'] ?? Str::slug($data['label'], '_');
            $data['value'] = $data['value'] ?? $data['key'];

            /** @var Option $option */
            $option = $this->options->create($data);

            return $this->apiResource($option, OptionResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $data = $this->normalizePayload($data);

            /** @var Option $option */
            $option = $this->options->update($id, $data);

            return $this->apiResource($option, OptionResource::class);
        });
    }

    public function reorder(array $data)
    {
        return $this->transaction(function () use ($data) {
            $group = $data['group'];
            $optionIds = array_values($data['optionIds']);

            foreach ($optionIds as $index => $optionId) {
                DB::table('options')
                    ->where('group', $group)
                    ->where('id', $optionId)
                    ->whereNull('deleted_at')
                    ->update([
                        'sort_order' => ($index + 1) * 10,
                        'updated_at' => now(),
                    ]);
            }

            return $this->apiCollection($this->options->findAll(['group' => $group]), OptionResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var Option $option */
            $option = $this->options->findOrFail($id);

            if (
                $option->statusLeads()->exists()
                || $option->sourceLeads()->exists()
                || $option->industryLeads()->exists()
                || $option->typeCustomers()->exists()
                || $option->sourceCustomers()->exists()
                || $option->industryCustomers()->exists()
                || $option->statusProjects()->exists()
                || $option->projectCostsByBankAccount()->exists()
            ) {
                throw new ConflictHttpException('Không thể xóa option đang được sử dụng');
            }

            $option->delete();

            return ['message' => 'Xóa option thành công'];
        });
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        if (array_key_exists('is_active', $data) && $data['is_active'] === null) {
            unset($data['is_active']);
        }

        if (array_key_exists('sort_order', $data) && $data['sort_order'] === null) {
            $data['sort_order'] = 0;
        }

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'sortOrder' => 'sort_order',
            'isActive' => 'is_active',
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
