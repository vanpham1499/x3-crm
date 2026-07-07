<?php

namespace App\Http\Controllers;

use App\Http\Requests\Quotations\CreateQuotationRequest;
use App\Http\Requests\Quotations\UpdateQuotationRequest;
use App\Services\QuotationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuotationsController extends Controller
{
    public function __construct(private readonly QuotationsService $quotations) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->quotations->findAll([
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'leadId' => $request->query('lead_id'),
            'customerId' => $request->query('customer_id'),
            'projectId' => $request->query('project_id'),
            'contractId' => $request->query('contract_id'),
            'serviceId' => $request->query('service_id'),
            'status' => $request->query('status'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->quotations->findOne($id));
    }

    public function store(CreateQuotationRequest $request): JsonResponse
    {
        return $this->success($this->quotations->create($request->validatedData()), 201);
    }

    public function update(UpdateQuotationRequest $request, string $id): JsonResponse
    {
        return $this->success($this->quotations->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->quotations->remove($id));
    }
}
