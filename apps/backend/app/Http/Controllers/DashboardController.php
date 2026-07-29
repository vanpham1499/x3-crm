<?php

namespace App\Http\Controllers;

use App\Http\Requests\Dashboard\GetDashboardReportRequest;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(private readonly DashboardService $dashboard) {}

    public function report(GetDashboardReportRequest $request): JsonResponse
    {
        $filters = $request->validatedData();

        return $this->success($this->dashboard->report(
            $filters['period_from'] ?? null,
            $filters['period_to'] ?? null,
        ));
    }
}
