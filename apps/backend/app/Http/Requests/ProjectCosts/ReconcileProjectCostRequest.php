<?php

namespace App\Http\Requests\ProjectCosts;

use App\Http\Requests\BaseRequest;
use App\Models\ProjectCost;
use App\Models\ProjectCostAdjustment;
use Illuminate\Validation\Rule;

class ReconcileProjectCostRequest extends BaseRequest
{
    protected function prepareForValidation(): void
    {
        $invoiceNumber = $this->input('invoiceNumber', $this->input('invoice_number'));
        $adjustments = collect($this->input('adjustments', []))
            ->filter(fn ($item) => is_array($item))
            ->map(fn ($item) => [
                'adjustmentType' => $item['adjustmentType'] ?? $item['adjustment_type'] ?? null,
                'status' => $item['status'] ?? ProjectCostAdjustment::STATUS_COMPLETED,
                'amount' => $item['amount'] ?? 0,
                'reference' => $item['reference'] ?? null,
                'note' => $item['note'] ?? null,
            ])
            ->values()
            ->all();

        $this->merge([
            'invoiceNumber' => is_string($invoiceNumber) ? trim($invoiceNumber) : $invoiceNumber,
            'reconciliationResult' => $this->input(
                'reconciliationResult',
                $this->input('reconciliation_result', ProjectCost::RECONCILIATION_UNMATCHED),
            ),
            'reconciliationNote' => $this->input('reconciliationNote', $this->input('reconciliation_note')),
            'adjustments' => $adjustments,
        ]);
    }

    public function rules(): array
    {
        return [
            'reconciliationResult' => ['required', Rule::in([
                ProjectCost::RECONCILIATION_MATCHED,
                ProjectCost::RECONCILIATION_UNMATCHED,
            ])],
            'invoiceNumber' => [
                'nullable',
                'string',
                'max:100',
            ],
            'reconciliationNote' => ['nullable', 'string', 'max:2000'],
            'adjustments' => ['nullable', 'array', 'max:20'],
            'adjustments.*.adjustmentType' => ['required', Rule::in(ProjectCostAdjustment::ALL_TYPES)],
            'adjustments.*.status' => ['required', Rule::in(ProjectCostAdjustment::STATUSES)],
            'adjustments.*.amount' => ['required', 'numeric', 'min:0.01'],
            'adjustments.*.reference' => ['nullable', 'string', 'max:255'],
            'adjustments.*.note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'reconciliationResult.in' => 'Kết quả đối soát chỉ được chọn Khớp chuẩn hoặc Chưa khớp.',
            'invoiceNumber.max' => 'Số hóa đơn không được vượt quá 100 ký tự.',
            'adjustments.*.adjustmentType.required' => 'Vui lòng chọn loại xử lý số dư.',
            'adjustments.*.amount.min' => 'Số tiền xử lý phải lớn hơn 0.',
        ];
    }
}
