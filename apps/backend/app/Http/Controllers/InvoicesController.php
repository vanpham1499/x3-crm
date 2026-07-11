<?php

namespace App\Http\Controllers;

use App\Http\Requests\Invoices\CreateInvoiceRequest;
use App\Http\Requests\Invoices\UpdateInvoiceRequest;
use App\Services\InvoicesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoicesController extends Controller
{
    public function __construct(private readonly InvoicesService $invoices) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->invoices->findAll([
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'customerId' => $request->query('customer_id'),
            'revenueId' => $request->query('revenue_id'),
            'status' => $request->query('status'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->invoices->findOne($id));
    }

    public function store(CreateInvoiceRequest $request): JsonResponse
    {
        return $this->success($this->invoices->create($request->validatedData()), 201);
    }

    public function update(UpdateInvoiceRequest $request, string $id): JsonResponse
    {
        return $this->success($this->invoices->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->invoices->remove($id));
    }
}
