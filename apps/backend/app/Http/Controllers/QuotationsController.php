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
        $filters = [
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'leadId' => $request->query('lead_id'),
            'customerId' => $request->query('customer_id'),
            'projectId' => $request->query('project_id'),
            'contractId' => $request->query('contract_id'),
            'serviceId' => $request->query('service_id'),
            'status' => $request->query('status'),
        ];

        if ($request->query->has('page') || $request->query->has('per_page')) {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(100, max(1, (int) $request->query('per_page', 10)));
            $result = $this->quotations->findPaginated($filters, $perPage, $page);

            return $this->success($result['data'], 200, $result['meta']);
        }

        return $this->success($this->quotations->findAll($filters));
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
