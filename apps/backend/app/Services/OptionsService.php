<?php

namespace App\Services;

use App\Http\Resources\OptionResource;
use App\Models\Option;
use App\Models\Service;
use App\Repositories\OptionRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
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
            $data = $this->prepareServiceKpiGroupPayload($data);

            /** @var Option $option */
            $option = $this->options->create($data);

            return $this->apiResource($option, OptionResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var Option $existingOption */
            $existingOption = $this->options->findOrFail($id);
            $data = $this->normalizePayload($data);

            if (isset($data['meta']) && is_array($data['meta'])) {
                $data['meta'] = array_merge($existingOption->meta ?? [], $data['meta']);
            }

            $data = $this->prepareServiceKpiGroupPayload($data, $existingOption);

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

    private function prepareServiceKpiGroupPayload(
        array $data,
        ?Option $existingOption = null,
    ): array {
        $group = $data['group'] ?? $existingOption?->group;

        if ($group !== Option::GROUP_SERVICE_KPI) {
            return $data;
        }

        $meta = array_merge(
            $existingOption?->meta ?? [],
            is_array($data['meta'] ?? null) ? $data['meta'] : [],
        );
        $serviceRootIds = collect($meta['serviceRootIds'] ?? [])
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values();

        if ($serviceRootIds->count() < 2) {
            throw ValidationException::withMessages([
                'meta.serviceRootIds' => ['Mỗi nhóm KPI phải có ít nhất 2 dịch vụ cha.'],
            ]);
        }

        $validServiceCount = Service::query()
            ->whereNull('parent_id')
            ->whereIn('id', $serviceRootIds)
            ->count();

        if ($validServiceCount !== $serviceRootIds->count()) {
            throw ValidationException::withMessages([
                'meta.serviceRootIds' => ['Nhóm KPI chỉ được chứa dịch vụ cha đang tồn tại.'],
            ]);
        }

        $label = trim((string) ($data['label'] ?? $existingOption?->label ?? ''));
        $duplicateLabel = Option::query()
            ->where('group', Option::GROUP_SERVICE_KPI)
            ->where('label', $label)
            ->when($existingOption, fn ($query) => $query->where('id', '!=', $existingOption->id))
            ->exists();

        if ($duplicateLabel) {
            throw ValidationException::withMessages([
                'label' => ['Tên nhóm KPI đã tồn tại.'],
            ]);
        }

        $conflictingGroup = Option::query()
            ->where('group', Option::GROUP_SERVICE_KPI)
            ->when($existingOption, fn ($query) => $query->where('id', '!=', $existingOption->id))
            ->get()
            ->first(function (Option $option) use ($serviceRootIds): bool {
                $assignedIds = collect(($option->meta ?? [])['serviceRootIds'] ?? [])
                    ->map(fn ($id): int => (int) $id);

                return $assignedIds->intersect($serviceRootIds)->isNotEmpty();
            });

        if ($conflictingGroup) {
            throw ValidationException::withMessages([
                'meta.serviceRootIds' => [
                    "Có dịch vụ đã thuộc nhóm KPI {$conflictingGroup->label}.",
                ],
            ]);
        }

        $meta['serviceRootIds'] = $serviceRootIds->all();
        $data['label'] = $label;
        $data['meta'] = $meta;
        $data['value'] = Option::GROUP_SERVICE_KPI;
        $data['is_active'] = $data['is_active'] ?? true;

        return $data;
    }
}
