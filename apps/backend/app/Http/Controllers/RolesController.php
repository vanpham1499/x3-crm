<?php

namespace App\Http\Controllers;

use App\Http\Requests\Roles\CreateRoleRequest;
use App\Http\Requests\Roles\SyncRolePermissionsRequest;
use App\Http\Requests\Roles\UpdateRoleRequest;
use App\Services\RolesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RolesController extends Controller
{
    public function __construct(private readonly RolesService $roles)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->roles->findAll($request->query('keyword')));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->roles->findOne($id));
    }

    public function store(CreateRoleRequest $request): JsonResponse
    {
        return $this->success($this->roles->create($request->validatedData()), 201);
    }

    public function update(UpdateRoleRequest $request, string $id): JsonResponse
    {
        return $this->success($this->roles->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->roles->remove($id));
    }

    public function permissions(string $id): JsonResponse
    {
        return $this->success($this->roles->permissions($id));
    }

    public function syncPermissions(SyncRolePermissionsRequest $request, string $id): JsonResponse
    {
        return $this->success($this->roles->syncPermissions($id, $request->validatedData('permission_ids')));
    }
}
