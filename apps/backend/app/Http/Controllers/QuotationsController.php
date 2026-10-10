<?php

namespace App\Http\Controllers;

use App\Http\Requests\Quotations\CreateQuotationRequest;
use App\Http\Requests\Quotations\UpdateQuotationRequest;
use App\Http\Requests\Quotations\VoidQuotationRequest;
use App\Services\QuotationsService;
use App\Services\QuotationVoidService;
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
            'createdById' => $request->query('created_by'),
            'allocationOpen' => $request->query('allocation_open'),
            'dateFrom' => $request->query('date_from'),
            'dateTo' => $request->query('date_to'),
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
        $data = $this->quotations->findOne($id);
        if (empty($data['isVoided'])) $data['deliveryVersion'] = app(\App\Services\ZaloCrmDocuments::class)->source(request()->user(), 'quotation', (int) $id)['version'];
        return $this->success($data);
    }

    public function store(CreateQuotationRequest $request): JsonResponse
    {
        return $this->success($this->quotations->create($request->validatedData()), 201);
    }

    public function update(UpdateQuotationRequest $request, string $id): JsonResponse
    {
        return $this->success($this->quotations->update($id, $request->validatedData()));
    }

    public function voidPreview(VoidQuotationRequest $request, string $id, QuotationVoidService $service): JsonResponse
    {
        return $this->success($service->preview($id, $request->validatedData()));
    }

    public function voidQuotation(VoidQuotationRequest $request, string $id, QuotationVoidService $service): JsonResponse
    {
        return $this->success($service->execute($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->quotations->remove($id));
    }
}
