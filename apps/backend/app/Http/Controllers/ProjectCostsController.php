<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectCosts\CreateProjectCostRequest;
use App\Http\Requests\ProjectCosts\ReconcileProjectCostRequest;
use App\Http\Requests\ProjectCosts\UpdateProjectCostRequest;
use App\Services\ProjectCostsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectCostsController extends Controller
{
    public function __construct(private readonly ProjectCostsService $costs) {}

    public function index(Request $request): JsonResponse
    {
        $filters = [
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'projectId' => $request->query('project_id'),
            'quotationId' => $request->query('quotation_id'),
            'entryType' => $request->query('entry_type'),
            'status' => $request->query('status'),
            'reconciledStatus' => $request->query('reconciled_status'),
            'dateFrom' => $request->query('date_from'),
            'dateTo' => $request->query('date_to'),
            'groupByProject' => $request->boolean('group_by_project'),
        ];

        if ($request->query->has('page') || $request->query->has('per_page')) {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(100, max(1, (int) $request->query('per_page', 10)));
            $result = $this->costs->findPaginated($filters, $perPage, $page);

            return $this->success($result['data'], 200, $result['meta']);
        }

        return $this->success($this->costs->findAll($filters));
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

    public function reconcile(ReconcileProjectCostRequest $request, string $id): JsonResponse
    {
        return $this->success($this->costs->reconcile($id, $request->validatedData()));
    }
}
