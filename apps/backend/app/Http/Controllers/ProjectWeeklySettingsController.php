<?php

namespace App\Http\Controllers;

use App\Http\Requests\WeeklySettings\CreateProjectWeeklySettingRequest;
use App\Http\Requests\WeeklySettings\UpdateProjectWeeklySettingRequest;
use App\Services\ProjectWeeklySettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProjectWeeklySettingsController extends Controller
{
    public function __construct(private readonly ProjectWeeklySettingsService $settings) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->settings->findAll([
            'project_id' => $request->query('project_id'),
            'report_owner_user_id' => $request->query('report_owner_user_id'),
            'is_active' => $request->has('is_active') ? $request->boolean('is_active') : null,
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->settings->findOne($id));
    }

    public function assignmentSummary(Request $request): JsonResponse
    {
        $data = $request->validate([
            'report_owner_user_id' => ['required', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'report_weekday' => ['required', 'integer', 'min:1', 'max:7'],
            'exclude_project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
        ]);

        return $this->success($this->settings->assignmentSummary(
            (int) $data['report_owner_user_id'],
            (int) $data['report_weekday'],
            isset($data['exclude_project_id']) ? (int) $data['exclude_project_id'] : null,
        ));
    }

    public function store(CreateProjectWeeklySettingRequest $request): JsonResponse
    {
        return $this->success($this->settings->upsertForProject($request->validatedData()), 201);
    }

    public function update(UpdateProjectWeeklySettingRequest $request, string $id): JsonResponse
    {
        return $this->success($this->settings->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->settings->remove($id));
    }
}
