<?php

namespace App\Services;

use App\Http\Resources\DepartmentResource;
use App\Models\Department;
use App\Models\User;
use App\Repositories\DepartmentRepository;
use Illuminate\Validation\ValidationException;

class DepartmentsService extends BaseService
{
    public function __construct(private readonly DepartmentRepository $departments)
    {
    }

    public function findAll(?string $keyword = null)
    {
        return $this->apiCollection($this->departments->findAll($keyword), DepartmentResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource(
            $this->departments->findWithRelationsOrFail($id),
            DepartmentResource::class,
        );
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $payload = $this->normalizePayload($data);

            /** @var Department $department */
            $department = $this->departments->create($payload['attributes']);
            $this->syncMembers($department, $payload['member_user_ids']);

            return $this->apiResource(
                $this->departments->findWithRelationsOrFail((string) $department->id),
                DepartmentResource::class,
            );
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $payload = $this->normalizePayload($data);

            /** @var Department $department */
            $department = $this->departments->update($id, $payload['attributes']);
            $this->syncMembers($department, $payload['member_user_ids']);

            return $this->apiResource(
                $this->departments->findWithRelationsOrFail($id),
                DepartmentResource::class,
            );
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $department = $this->departments->findWithRelationsOrFail($id);
            $this->clearMembers($department);
            $department->forceFill(['leader_user_id' => null])->save();
            $this->departments->delete($id);

            return ['message' => 'Xóa phòng ban thành công'];
        });
    }

    /**
     * @return array{attributes: array{name: string, leader_user_id: int}, member_user_ids: array<int>}
     */
    private function normalizePayload(array $data): array
    {
        return [
            'attributes' => [
                'name' => trim((string) $data['name']),
                'leader_user_id' => (int) $data['leaderUserId'],
            ],
            'member_user_ids' => collect($data['memberUserIds'] ?? [])
                ->map(fn ($userId): int => (int) $userId)
                ->filter()
                ->unique()
                ->values()
                ->all(),
        ];
    }

    /** @param array<int> $memberUserIds */
    private function syncMembers(Department $department, array $memberUserIds): void
    {
        $memberUserIds = collect($memberUserIds)
            ->push((int) $department->leader_user_id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        $hasLeaderFromAnotherDepartment = Department::query()
            ->where('id', '<>', $department->id)
            ->whereIn('leader_user_id', $memberUserIds)
            ->exists();

        if ($hasLeaderFromAnotherDepartment) {
            throw ValidationException::withMessages([
                'memberUserIds' => 'Một nhân viên đã chọn đang là Lead của phòng ban khác.',
            ]);
        }

        $now = now();
        $auditValues = [
            'updated_by' => $this->currentUser()?->id,
            'updated_at' => $now,
        ];

        User::query()
            ->where('department_id', $department->id)
            ->whereNotIn('id', $memberUserIds)
            ->update(array_merge(['department_id' => null], $auditValues));

        User::query()
            ->whereIn('id', $memberUserIds)
            ->update(array_merge(['department_id' => $department->id], $auditValues));
    }

    private function clearMembers(Department $department): void
    {
        User::query()
            ->where('department_id', $department->id)
            ->update([
                'department_id' => null,
                'updated_by' => $this->currentUser()?->id,
                'updated_at' => now(),
            ]);
    }
}
