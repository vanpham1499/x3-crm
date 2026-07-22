<?php

namespace App\Http\Controllers;

use App\Http\Requests\Departments\CreateDepartmentRequest;
use App\Http\Requests\Departments\UpdateDepartmentRequest;
use App\Services\DepartmentsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentsController extends Controller
{
    public function __construct(private readonly DepartmentsService $departments)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->departments->findAll($request->query('keyword')));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->departments->findOne($id));
    }

    public function store(CreateDepartmentRequest $request): JsonResponse
    {
        return $this->success($this->departments->create($request->validatedData()), 201);
    }

    public function update(UpdateDepartmentRequest $request, string $id): JsonResponse
    {
        return $this->success($this->departments->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->departments->remove($id));
    }
}
