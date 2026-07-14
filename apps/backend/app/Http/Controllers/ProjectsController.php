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
        $filters = [
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'customerId' => $request->query('customer_id'),
            'serviceId' => $request->query('service_id'),
            'statusOptionId' => $request->query('status_option_id'),
            'status' => $request->query('status'),
            'managerUserId' => $request->query('manager_user_id'),
            'salesUserId' => $request->query('sales_user_id'),
        ];

        if ($request->query->has('page') || $request->query->has('per_page')) {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(100, max(1, (int) $request->query('per_page', 10)));
            $result = $this->projects->findPaginated($filters, $perPage, $page);

            return $this->success($result['data'], 200, $result['meta']);
        }

        return $this->success($this->projects->findAll($filters));
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
