<?php

namespace App\Services;

use App\Http\Resources\PermissionResource;
use App\Repositories\PermissionRepository;

class PermissionsService extends BaseService
{
    public function __construct(private readonly PermissionRepository $permissions)
    {
    }

    public function findAll(?string $module = null, ?string $keyword = null)
    {
        return $this->apiCollection($this->permissions->findAll($module, $keyword), PermissionResource::class);
    }
}
