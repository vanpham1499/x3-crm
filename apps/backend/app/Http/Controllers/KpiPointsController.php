<?php

namespace App\Http\Controllers;

use App\Http\Requests\Kpi\CreateKpiPointRequest;
use App\Http\Requests\Kpi\UpdateKpiPointRequest;
use App\Services\KpiPointsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KpiPointsController extends Controller
{
    public function __construct(private readonly KpiPointsService $points) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->points->findAll([
            'keyword' => $request->query('keyword'),
            'userId' => $request->query('user_id'),
            'category' => $request->query('category'),
            'type' => $request->query('type'),
            'isApproved' => $request->has('is_approved') ? $request->boolean('is_approved') : null,
            'dateFrom' => $request->query('date_from'),
            'dateTo' => $request->query('date_to'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->points->findOne($id));
    }

    public function store(CreateKpiPointRequest $request): JsonResponse
    {
        return $this->success($this->points->create($request->validatedData()), 201);
    }

    public function update(UpdateKpiPointRequest $request, string $id): JsonResponse
    {
        return $this->success($this->points->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->points->remove($id));
    }

    public function approve(string $id): JsonResponse
    {
        return $this->success($this->points->approve($id));
    }
}
