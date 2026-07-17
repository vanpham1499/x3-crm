<?php

namespace App\Http\Controllers;

use App\Http\Requests\WeeklyReports\CreateWeeklyReportRequest;
use App\Http\Requests\WeeklyReports\UpdateWeeklyReportRequest;
use App\Services\WeeklyReportsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeeklyReportsController extends Controller
{
    public function __construct(private readonly WeeklyReportsService $reports) {}

    public function index(Request $request): JsonResponse
    {
        $filters = [
            'project_id' => $request->query('project_id'),
            'reporter_user_id' => $request->query('reporter_user_id'),
            'status' => $request->query('status'),
            'week_start_date' => $request->query('week_start_date'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
        ];

        if ($request->query->has('page') || $request->query->has('per_page')) {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(100, max(1, (int) $request->query('per_page', 10)));
            $result = $this->reports->findPaginated($filters, $perPage, $page);

            return $this->success($result['data'], 200, $result['meta']);
        }

        return $this->success($this->reports->findAll($filters));
    }

    public function board(Request $request): JsonResponse
    {
        $filters = [
            'week_start' => $request->query('week_start'),
            'keyword' => $request->query('keyword'),
            'report_owner_user_id' => $request->query('report_owner_user_id'),
            'report_weekday' => $request->query('report_weekday'),
            'due_status' => $request->query('due_status'),
            'progress_status' => $request->query('progress_status'),
            'weekly_condition' => $request->query('weekly_condition'),
        ];
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(100, max(1, (int) $request->query('per_page', 10)));
        $result = $this->reports->board($filters, $perPage, $page);

        return $this->success($result['data'], 200, $result['meta']);
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->reports->findOne($id));
    }

    public function store(CreateWeeklyReportRequest $request): JsonResponse
    {
        return $this->success($this->reports->create($request->validatedData()), 201);
    }

    public function update(UpdateWeeklyReportRequest $request, string $id): JsonResponse
    {
        return $this->success($this->reports->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->reports->remove($id));
    }

    public function submit(string $id): JsonResponse
    {
        return $this->success($this->reports->submit($id));
    }

    public function approve(string $id): JsonResponse
    {
        return $this->success($this->reports->approve($id));
    }

    public function returnToDraft(string $id): JsonResponse
    {
        return $this->success($this->reports->returnToDraft($id));
    }
}
