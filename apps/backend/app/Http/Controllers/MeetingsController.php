<?php

namespace App\Http\Controllers;

use App\Http\Requests\Meetings\CancelMeetingRequest;
use App\Http\Requests\Meetings\CompleteMeetingRequest;
use App\Http\Requests\Meetings\CreateMeetingRequest;
use App\Http\Requests\Meetings\UpdateMeetingRequest;
use App\Services\MeetingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeetingsController extends Controller
{
    public function __construct(private readonly MeetingsService $meetings) {}

    public function index(Request $request): JsonResponse
    {
        $filters = [
            'keyword' => $request->query('keyword'),
            'organizer_user_id' => $request->query('organizer_user_id'),
            'department_id' => $request->query('department_id'),
            'meeting_type' => $request->query('meeting_type'),
            'status' => $request->query('status'),
            'lead_id' => $request->query('lead_id'),
            'customer_id' => $request->query('customer_id'),
            'project_id' => $request->query('project_id'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'scope' => $request->query('scope'),
        ];

        if ($request->query->has('page') || $request->query->has('per_page')) {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(100, max(1, (int) $request->query('per_page', 20)));
            $result = $this->meetings->findPaginated($filters, $perPage, $page);

            return $this->success($result['data'], 200, $result['meta']);
        }

        return $this->success($this->meetings->findAll($filters));
    }

    public function summary(): JsonResponse
    {
        return $this->success($this->meetings->summary());
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->meetings->findOne($id));
    }

    public function store(CreateMeetingRequest $request): JsonResponse
    {
        return $this->success($this->meetings->create($request->validatedData()), 201);
    }

    public function update(UpdateMeetingRequest $request, string $id): JsonResponse
    {
        return $this->success($this->meetings->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->meetings->remove($id));
    }

    public function confirm(string $id): JsonResponse
    {
        return $this->success($this->meetings->confirm($id));
    }

    public function complete(CompleteMeetingRequest $request, string $id): JsonResponse
    {
        return $this->success($this->meetings->complete($id, $request->validatedData()));
    }

    public function cancel(CancelMeetingRequest $request, string $id): JsonResponse
    {
        return $this->success($this->meetings->cancel($id, $request->string('reason')->toString()));
    }

    public function markNoShow(string $id): JsonResponse
    {
        return $this->success($this->meetings->markNoShow($id));
    }
}
