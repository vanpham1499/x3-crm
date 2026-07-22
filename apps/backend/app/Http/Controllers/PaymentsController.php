<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payments\AllocatePaymentRequest;
use App\Http\Requests\Payments\CreatePaymentRequest;
use App\Http\Requests\Payments\LinkPaymentRequest;
use App\Http\Requests\Payments\RefundPaymentRequest;
use App\Http\Requests\Payments\UpdatePaymentRefundRequest;
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
        $filters = [
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'quotationId' => $request->query('quotation_id'),
            'leadId' => $request->query('lead_id'),
            'customerId' => $request->query('customer_id'),
            'projectId' => $request->query('project_id'),
            'contractId' => $request->query('contract_id'),
            'status' => $request->query('status'),
            'reconciledStatus' => $request->query('reconciled_status'),
            'dateFrom' => $request->query('date_from'),
            'dateTo' => $request->query('date_to'),
            'groupByQuotation' => $request->boolean('group_by_quotation'),
        ];

        if ($request->query->has('page') || $request->query->has('per_page')) {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(100, max(1, (int) $request->query('per_page', 10)));
            $result = $this->payments->findPaginated($filters, $perPage, $page);

            return $this->success($result['data'], 200, $result['meta']);
        }

        return $this->success($this->payments->findAll($filters));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->payments->findOne($id));
    }

    public function refundIndex(Request $request): JsonResponse
    {
        $filters = [
            'keyword' => $request->query('keyword'),
            'refundType' => $request->query('refund_type'),
            'status' => $request->query('status'),
            'dateFrom' => $request->query('date_from'),
            'dateTo' => $request->query('date_to'),
        ];
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(100, max(1, (int) $request->query('per_page', 10)));
        $result = $this->payments->findRefundsPaginated($filters, $perPage, $page);

        return $this->success($result['data'], 200, $result['meta']);
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

    public function allocate(AllocatePaymentRequest $request, string $id): JsonResponse
    {
        return $this->success($this->payments->allocate($id, $request->validatedData()));
    }

    public function removeAllocation(string $paymentId, string $allocationId): JsonResponse
    {
        return $this->success($this->payments->removeAllocation($paymentId, $allocationId));
    }

    public function refund(RefundPaymentRequest $request, string $id): JsonResponse
    {
        return $this->success($this->payments->refund($id, $request->validatedData()));
    }

    public function updateRefund(UpdatePaymentRefundRequest $request, string $id): JsonResponse
    {
        return $this->success($this->payments->updateRefund($id, $request->validatedData()));
    }

    public function destroyRefund(string $id): JsonResponse
    {
        return $this->success($this->payments->removeRefund($id));
    }

    public function link(LinkPaymentRequest $request, string $id): JsonResponse
    {
        return $this->success($this->payments->link($id, $request->validatedData()));
    }
}
