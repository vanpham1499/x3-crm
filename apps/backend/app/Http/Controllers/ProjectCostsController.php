<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectCosts\CreateProjectCostRequest;
use App\Http\Requests\ProjectCosts\UpdateProjectCostRequest;
use App\Services\ProjectCostsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectCostsController extends Controller
{
    public function __construct(private readonly ProjectCostsService $costs) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->costs->findAll([
            'projectId' => $request->query('project_id'),
            'quotationId' => $request->query('quotation_id'),
            'entryType' => $request->query('entry_type'),
            'status' => $request->query('status'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->costs->findOne($id));
    }

    public function store(CreateProjectCostRequest $request): JsonResponse
    {
        return $this->success($this->costs->create($request->validatedData()), 201);
    }

    public function update(UpdateProjectCostRequest $request, string $id): JsonResponse
    {
        return $this->success($this->costs->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->costs->remove($id));
    }
}
