<?php

namespace App\Http\Controllers;

use App\Http\Requests\Leads\ConvertLeadRequest;
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
        $filters = [
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'statusOptionId' => $request->query('status_option_id'),
            'status' => $request->query('status'),
            'assignedUserId' => $request->query('assigned_user_id'),
            'sourceOptionId' => $request->query('source_option_id'),
            'source' => $request->query('source'),
            'industryOptionId' => $request->query('industry_option_id'),
            'industry_option' => $request->query('industry'),
            'interestedServiceOptionId' => $request->query('interested_service_option_id'),
            'interestedServiceId' => $request->query('interested_service_id'),
            'occurredFrom' => $request->query('occurred_from'),
            'occurredTo' => $request->query('occurred_to'),
            'closedFrom' => $request->query('closed_from'),
            'closedTo' => $request->query('closed_to'),
        ];

        if ($request->query->has('page') || $request->query->has('per_page')) {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(100, max(1, (int) $request->query('per_page', 10)));
            $result = $this->leads->findPaginated($filters, $perPage, $page);

            return $this->success($result['data'], 200, $result['meta']);
        }

        return $this->success($this->leads->findAll($filters));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->leads->findOne($id));
    }

    public function store(CreateLeadRequest $request): JsonResponse
    {
        return $this->success($this->leads->create($request->validatedData()), 201);
    }

    public function convert(ConvertLeadRequest $request, string $id): JsonResponse
    {
        return $this->success($this->leads->convert($id, $request->validatedData()), 201);
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
