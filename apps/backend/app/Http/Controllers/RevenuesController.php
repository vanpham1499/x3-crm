<?php

namespace App\Http\Controllers;

use App\Http\Requests\Revenues\CreateRevenueRequest;
use App\Http\Requests\Revenues\UpdateRevenueRequest;
use App\Services\RevenuesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RevenuesController extends Controller
{
    public function __construct(private readonly RevenuesService $revenues) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->revenues->findAll([
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'projectId' => $request->query('project_id'),
            'paymentStatus' => $request->query('payment_status'),
            'invoiceStatus' => $request->query('invoice_status'),
            'revenueMonth' => $request->query('revenue_month'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->revenues->findOne($id));
    }

    public function store(CreateRevenueRequest $request): JsonResponse
    {
        return $this->success($this->revenues->create($request->validatedData()), 201);
    }

    public function update(UpdateRevenueRequest $request, string $id): JsonResponse
    {
        return $this->success($this->revenues->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->revenues->remove($id));
    }
}
