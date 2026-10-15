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
        $data = $request->validate(['period' => ['required', 'regex:/^20\d{2}-(0[1-9]|1[0-2])$/']]);

        return $this->success($this->finance->report($data['period']));
    }

    public function confirm(Request $request, string $type, int $id): JsonResponse
    {
        $this->entity($type);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:0'], 'reason' => ['required', 'string', 'min:3', 'max:2000'],
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
