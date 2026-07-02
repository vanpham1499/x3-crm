<?php

namespace App\Services;

use App\Http\Resources\PermissionResource;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Repositories\RoleRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RolesService extends BaseService
{
    public function __construct(private readonly RoleRepository $roles)
    {
    }

    public function findAll(?string $keyword = null)
    {
        return $this->apiCollection($this->roles->findAll($keyword), RoleResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->roles->findWithPermissionsOrFail($id), RoleResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            /** @var Role $role */
            $role = $this->roles->create($data);

            return $this->apiResource($role->load('permissions'), RoleResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var Role $role */
            $role = $this->roles->update($id, $data);

            return $this->apiResource($role->load('permissions'), RoleResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->roles->delete($id);

            return ['message' => 'Xóa vai trò thành công'];
        });
    }

    public function permissions(string $id)
    {
        return $this->apiCollection($this->roles->findWithPermissionsOrFail($id)->permissions, PermissionResource::class);
    }

    public function syncPermissions(string $id, array $permissionIds): array
    {
        return $this->transaction(function () use ($id, $permissionIds): array {
            $role = $this->roles->findWithPermissionsOrFail($id);

            DB::table('role_permissions')->where('role_id', $role->id)->delete();

            $now = now();
            $rows = collect($permissionIds)
                ->map(fn (string $permissionId): array => [
                    'id' => (string) Str::uuid(),
                    'role_id' => $role->id,
                    'permission_id' => $permissionId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
                ->values()
                ->all();

            if ($rows !== []) {
                DB::table('role_permissions')->insert($rows);
            }

            return [
                'message' => 'Cập nhật quyền cho vai trò thành công',
                'role' => $this->apiResource($role->fresh('permissions'), RoleResource::class),
            ];
        });
    }
}
