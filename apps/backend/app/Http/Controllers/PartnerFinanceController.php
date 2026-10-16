<?php

namespace App\Http\Controllers;

use App\Services\PartnerFinanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PartnerFinanceController extends Controller
{
    public function __construct(private readonly PartnerFinanceService $finance) {}

    private function entity(string $type): void
    {
        abort_unless(in_array($type, ['cost', 'revenue'], true), 404);
    }

    public function report(Request $request): JsonResponse
    {
        return $this->success(app(\App\Services\PartnerFinanceReadService::class)->page($this->filters($request)));
    }

    private function filters(Request $request): array
    {
        return $request->validate(['period' => ['required', 'regex:/^20\d{2}-(0[1-9]|1[0-2])$/'],
            'keyword' => ['nullable', 'string', 'max:200'], 'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'in:10,20,50,100'], 'status' => ['sometimes', 'in:ready,review,waiting']]);
    }

    public function summary(Request $request): JsonResponse
    {
        return $this->success(app(\App\Services\PartnerFinanceReadService::class)->summary($this->filters($request)));
    }

    public function suggestions(Request $request): JsonResponse
    {
        return $this->success(app(\App\Services\PartnerFinanceReadService::class)->suggestions($this->filters($request)));
    }

    public function selection(Request $request): JsonResponse
    {
        return $this->success(app(\App\Services\PartnerFinanceReadService::class)->selection($this->filters($request)));
    }

    public function project(Request $request, int $id): JsonResponse
    {
        return $this->success(app(\App\Services\PartnerFinanceReadService::class)->detail($id, $this->filters($request)['period']));
    }

    public function confirmBatch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'requestId' => ['required', 'uuid'], 'period' => ['required', 'regex:/^20\d{2}-(0[1-9]|1[0-2])$/'],
            'reason' => ['nullable', 'string', 'min:3', 'max:1000'],
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*.type' => ['required', 'in:revenue,cost'], 'items.*.id' => ['required', 'integer', 'min:1'],
            'items.*.fingerprint' => ['required', 'string', 'size:64'],
        ]);
        return $this->success($this->finance->confirmBatch($data));
    }

    public function confirm(Request $request, string $type, int $id): JsonResponse
    {
        $this->entity($type);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:0'], 'reason' => ['nullable', 'string', 'min:3', 'max:2000'],
            'allocations' => ['required', 'array', 'min:1', 'max:60'], 'allocations.*.period' => ['required', 'regex:/^20\d{2}-(0[1-9]|1[0-2])$/'],
            'allocations.*.amount' => ['required', 'numeric', 'min:0', 'decimal:0,2']]);

        return $this->success($this->finance->confirm($type, $id, $data));
    }

    public function unconfirm(Request $request, string $type, int $id): JsonResponse
    {
        $this->entity($type);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1'], 'reason' => ['required', 'string', 'min:3', 'max:2000']]);

        return $this->success($this->finance->unconfirm($type, $id, $data));
    }

    public function pay(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['requestId' => ['required', 'uuid'], 'paidOn' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2'], 'reference' => ['nullable', 'string', 'max:255'], 'note' => ['nullable', 'string', 'max:2000']]);

        return $this->success($this->finance->pay($id, $data));
    }

    public function payBatch(Request $request): JsonResponse
    {
        $data = $request->validate(['requestId' => ['required', 'uuid'], 'paidOn' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'allocations' => ['required', 'array', 'min:1', 'max:100'], 'allocations.*.costId' => ['required', 'integer', 'distinct'],
            'allocations.*.amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2', 'max:9999999999999'],
            'reference' => ['nullable', 'string', 'max:255'], 'note' => ['required', 'string', 'min:3', 'max:2000']]);

        return $this->success($this->finance->payBatch($data));
    }

    public function voidPayment(Request $request, int $id, int $paymentId): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:2000']]);

        return $this->success($this->finance->voidPayment($id, $paymentId, $data['reason']));
    }

    public function period(Request $request, string $period): JsonResponse
    {
        abort_unless(preg_match('/^20\d{2}-(0[1-9]|1[0-2])$/', $period), 422);
        $data = $request->validate(['locked' => ['required', 'boolean'], 'reason' => ['required', 'string', 'min:3', 'max:2000']]);

        return $this->success($this->finance->period($period, $data['locked'], $data['reason']));
    }

    public function history(string $type, int $id): JsonResponse
    {
        $this->entity($type);

        return $this->success($this->finance->history($type, $id));
    }
}
