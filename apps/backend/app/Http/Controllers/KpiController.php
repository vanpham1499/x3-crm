<?php

namespace App\Http\Controllers;

use App\Http\Requests\Kpi\GetKpiDetailRequest;
use App\Http\Requests\Kpi\GetKpiReportRequest;
use App\Http\Requests\Kpi\UpsertKpiTargetRequest;
use App\Services\KpiService;
use Illuminate\Http\JsonResponse;

class KpiController extends Controller
{
    public function __construct(private readonly KpiService $kpi) {}

    public function report(GetKpiReportRequest $request): JsonResponse
    {
        $filters = $request->validatedData();
        $periodFrom = $filters['period_from'] ?? $filters['period'] ?? null;
        $periodTo = $filters['period_to'] ?? $periodFrom;

        return $this->success($this->kpi->report($periodFrom, $periodTo, $request->user()));
    }

    public function detail(GetKpiDetailRequest $request): JsonResponse
    {
        $filters = $request->validatedData();

        return $this->success($this->kpi->detail(
            (string) $filters['period'],
            (string) $filters['scope_type'],
            (int) $filters['scope_id'],
            $request->user(),
        ));
    }

    public function upsertTarget(UpsertKpiTargetRequest $request): JsonResponse
    {
        return $this->success($this->kpi->upsertTarget($request->validatedData()));
    }
}
