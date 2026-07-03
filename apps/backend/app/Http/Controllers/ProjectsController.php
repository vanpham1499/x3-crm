<?php

namespace App\Http\Controllers;

use App\Http\Requests\Projects\CreateProjectRequest;
use App\Http\Requests\Projects\UpdateProjectRequest;
use App\Services\ProjectsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectsController extends Controller
{
    public function __construct(private readonly ProjectsService $projects) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->projects->findAll([
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'customerId' => $request->query('customer_id'),
            'serviceId' => $request->query('service_id'),
            'statusOptionId' => $request->query('status_option_id'),
            'status' => $request->query('status'),
            'managerUserId' => $request->query('manager_user_id'),
            'salesUserId' => $request->query('sales_user_id'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->projects->findOne($id));
    }

    public function store(CreateProjectRequest $request): JsonResponse
    {
        return $this->success($this->projects->create($request->validatedData()), 201);
    }

    public function update(UpdateProjectRequest $request, string $id): JsonResponse
    {
        return $this->success($this->projects->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->projects->remove($id));
    }
}
