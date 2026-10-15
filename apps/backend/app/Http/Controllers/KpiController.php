<?php

namespace App\Http\Controllers;

use App\Http\Requests\Kpi\GetKpiDetailRequest;
use App\Http\Requests\Kpi\GetKpiReportRequest;
use App\Http\Requests\Kpi\UpsertKpiTargetRequest;
use App\Services\KpiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class KpiController extends Controller
{
    public function revision(): JsonResponse
    {
        $parts = [];
        foreach (['quotations', 'payment_allocations', 'payment_refunds', 'payments', 'project_costs', 'project_cost_adjustments', 'kpi_targets', 'projects', 'users', 'services', 'options', 'teams'] as $table) {
            $parts[] = DB::table($table)
                ->selectRaw('count(*) as count, max(updated_at) as updated, max(deleted_at) as deleted')->first();
        }
        $parts[] = DB::table('partner_finance_recognitions')->selectRaw('count(*) as count, max(updated_at) as updated')->first();
        $parts[] = DB::table('partner_finance_audits')->selectRaw('max(id) as last_id')->first();

        $parts[] = DB::table('team_memberships')->selectRaw('count(*) as count, max(started_at) as started, max(ended_at) as ended')->first();
        return $this->success(['revision' => hash('sha256', json_encode($parts))]);
    }

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
