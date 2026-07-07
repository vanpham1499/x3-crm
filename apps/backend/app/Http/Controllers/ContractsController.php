<?php

namespace App\Http\Controllers;

use App\Http\Requests\Contracts\CreateContractRequest;
use App\Http\Requests\Contracts\UpdateContractRequest;
use App\Services\ContractsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractsController extends Controller
{
    public function __construct(private readonly ContractsService $contracts) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->contracts->findAll([
            'projectId' => $request->query('project_id'),
            'quotationId' => $request->query('quotation_id'),
            'leadId' => $request->query('lead_id'),
            'customerId' => $request->query('customer_id'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->contracts->findOne($id));
    }

    public function store(CreateContractRequest $request): JsonResponse
    {
        return $this->success($this->contracts->create($request->validatedData()), 201);
    }

    public function update(UpdateContractRequest $request, string $id): JsonResponse
    {
        return $this->success($this->contracts->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->contracts->remove($id));
    }
}
