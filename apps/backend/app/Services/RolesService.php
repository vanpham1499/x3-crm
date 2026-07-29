<?php

namespace App\Services;

use App\Http\Resources\PermissionResource;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Repositories\RoleRepository;
use Illuminate\Support\Facades\DB;

class RolesService extends BaseService
{
    private const PAGE_PERMISSION_BY_MODULE = [
        'dashboard' => 'dashboard.view',
        'lead' => 'lead.view',
        'customer' => 'customer.view',
        'project' => 'project.view',
        'meeting' => 'meeting.view',
        'quotation' => 'quotation.view',
        'payment' => 'payment.view',
        'cost' => 'cost.view',
        'weeklyreport' => 'weeklyreport.view',
        'kpi' => 'kpi.view',
        'p2point' => 'p2point.view',
        'media' => 'media.view',
        'user' => 'user.view',
        'department' => 'department.view',
        'role' => 'role.view',
        'permission' => 'permission.view',
        'option' => 'option.view',
        'service' => 'service.view',
        'partner' => 'partner.view',
        'bankaccount' => 'bankaccount.view',
        'adtopupcard' => 'adtopupcard.view',
        'p2category' => 'p2category.view',
    ];

    private const SUPPORT_PERMISSIONS_BY_MODULE = [
        'lead' => ['user.lookup'],
        'customer' => ['user.lookup'],
        'project' => ['user.lookup', 'customer.lookup'],
        'meeting' => ['user.lookup', 'department.lookup'],
        'weeklyreport' => ['user.lookup'],
        'p2point' => ['user.lookup'],
    ];

    public function __construct(private readonly RoleRepository $roles) {}

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
            $permissionIds = array_key_exists('permission_ids', $data)
                ? $data['permission_ids']
                : null;
            unset($data['permission_ids']);

            /** @var Role $role */
            $role = $this->roles->create($data);

            if ($permissionIds !== null) {
                $this->replacePermissions($role, $permissionIds);
            }

            return $this->apiResource($role->load('permissions'), RoleResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $permissionIds = array_key_exists('permission_ids', $data)
                ? $data['permission_ids']
                : null;
            unset($data['permission_ids']);

            /** @var Role $role */
            $role = $this->roles->update($id, $data);

            if ($permissionIds !== null) {
                $this->replacePermissions($role, $permissionIds);
            }

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
            $this->replacePermissions($role, $permissionIds);

            return [
                'message' => 'Cập nhật quyền cho vai trò thành công',
                'role' => $this->apiResource($role->fresh('permissions'), RoleResource::class),
            ];
        });
    }

    /** @param array<int> $permissionIds */
    private function replacePermissions(Role $role, array $permissionIds): void
    {
        $permissionIds = $this->normalizePermissionIds($permissionIds);
        DB::table('role_permissions')->where('role_id', $role->id)->delete();

        $now = now();
        $rows = collect($permissionIds)
            ->map(fn ($permissionId): array => [
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
    }

    /** @param array<int> $permissionIds */
    private function normalizePermissionIds(array $permissionIds): array
    {
        $permissions = DB::table('permissions')
            ->whereIn('id', $permissionIds)
            ->whereNull('deleted_at')
            ->get(['id', 'code', 'module']);
        $normalizedIds = $permissions->pluck('id');
        $scopeBaseCodes = $permissions
            ->pluck('code')
            ->filter(fn (string $code): bool => str_ends_with($code, '_department') || str_ends_with($code, '_all'))
            ->map(fn (string $code): string => preg_replace('/_(department|all)$/', '', $code) ?? $code)
            ->unique();

        if ($scopeBaseCodes->isNotEmpty()) {
            $normalizedIds = $normalizedIds->merge(
                DB::table('permissions')
                    ->whereIn('code', $scopeBaseCodes)
                    ->whereNull('deleted_at')
                    ->pluck('id'),
            );
        }

        $pageCodes = $permissions
            ->reject(fn ($permission) => str_ends_with($permission->code, '.lookup'))
            ->map(fn ($permission) => self::PAGE_PERMISSION_BY_MODULE[$permission->module] ?? null)
            ->filter()
            ->unique();

        if ($pageCodes->isNotEmpty()) {
            $normalizedIds = $normalizedIds->merge(
                DB::table('permissions')->whereIn('code', $pageCodes)->pluck('id'),
            );
        }

        $scopedPageCodes = $permissions
            ->filter(fn ($permission): bool => str_ends_with($permission->code, '_department') || str_ends_with($permission->code, '_all'))
            ->map(function ($permission): ?string {
                $pageCode = self::PAGE_PERMISSION_BY_MODULE[$permission->module] ?? null;

                if (! $pageCode) {
                    return null;
                }

                return $pageCode.(str_ends_with($permission->code, '_all') ? '_all' : '_department');
            })
            ->filter()
            ->unique();

        if ($scopedPageCodes->isNotEmpty()) {
            $normalizedIds = $normalizedIds->merge(
                DB::table('permissions')
                    ->whereIn('code', $scopedPageCodes)
                    ->whereNull('deleted_at')
                    ->pluck('id'),
            );
        }

        $supportCodes = $permissions
            ->pluck('module')
            ->flatMap(fn ($module) => self::SUPPORT_PERMISSIONS_BY_MODULE[$module] ?? [])
            ->unique();

        if ($supportCodes->isNotEmpty()) {
            $normalizedIds = $normalizedIds->merge(
                DB::table('permissions')
                    ->whereIn('code', $supportCodes)
                    ->whereNull('deleted_at')
                    ->pluck('id'),
            );
        }

        $roleEditorCodes = ['role.create', 'role.update', 'role.permission.update'];
        if ($permissions->pluck('code')->intersect($roleEditorCodes)->isNotEmpty()) {
            $permissionViewId = DB::table('permissions')
                ->where('code', 'permission.view')
                ->whereNull('deleted_at')
                ->value('id');

            if ($permissionViewId !== null) {
                $normalizedIds->push($permissionViewId);
            }
        }

        return $normalizedIds
            ->map(fn ($permissionId): int => (int) $permissionId)
            ->unique()
            ->values()
            ->all();
    }
}
