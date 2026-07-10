<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payments\CreatePaymentRequest;
use App\Http\Requests\Payments\UpdatePaymentRequest;
use App\Http\Requests\Payments\WebhookPaymentRequest;
use App\Services\PaymentsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentsController extends Controller
{
    public function __construct(private readonly PaymentsService $payments) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->payments->findAll([
            'quotationId' => $request->query('quotation_id'),
            'leadId' => $request->query('lead_id'),
            'customerId' => $request->query('customer_id'),
            'projectId' => $request->query('project_id'),
            'contractId' => $request->query('contract_id'),
            'status' => $request->query('status'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->payments->findOne($id));
    }

    public function store(CreatePaymentRequest $request): JsonResponse
    {
        return $this->success($this->payments->create($request->validatedData()), 201);
    }

    public function update(UpdatePaymentRequest $request, string $id): JsonResponse
    {
        return $this->success($this->payments->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->payments->remove($id));
    }

    public function webhook(WebhookPaymentRequest $request): JsonResponse
    {
        $this->payments->webhook($request->validatedData());

        return response()->json(['success' => true]);
    }

    public function matchProject(Request $request, string $id): JsonResponse
    {
        return $this->success($this->payments->matchProject($id, $request->all()));
    }
}
