<?php

namespace App\Http\Controllers;

use App\Http\Requests\Leads\CreateLeadRequest;
use App\Http\Requests\Leads\UpdateLeadRequest;
use App\Services\LeadsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeadsController extends Controller
{
    public function __construct(private readonly LeadsService $leads) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->leads->findAll([
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'statusId' => $request->query('status_id'),
            'assignedUserId' => $request->query('assigned_user_id'),
            'sourceId' => $request->query('source_id'),
            'interestedServiceId' => $request->query('interested_service_id'),
            'occurredFrom' => $request->query('occurred_from'),
            'occurredTo' => $request->query('occurred_to'),
            'closedFrom' => $request->query('closed_from'),
            'closedTo' => $request->query('closed_to'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->leads->findOne($id));
    }

    public function store(CreateLeadRequest $request): JsonResponse
    {
        return $this->success($this->leads->create($request->validatedData()), 201);
    }

    public function update(UpdateLeadRequest $request, string $id): JsonResponse
    {
        return $this->success($this->leads->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->leads->remove($id));
    }
}
