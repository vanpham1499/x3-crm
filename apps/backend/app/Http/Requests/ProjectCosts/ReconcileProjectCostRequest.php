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
                $this->input('reconciliation_result', ProjectCost::RECONCILIATION_MATCHED),
            ),
            'invoiceStatus' => $this->input(
                'invoiceStatus',
                $this->input('invoice_status', ProjectCost::INVOICE_STATUS_PENDING),
            ),
            'invoiceRecipientType' => $this->input(
                'invoiceRecipientType',
                $this->input('invoice_recipient_type', ProjectCost::INVOICE_RECIPIENT_CUSTOMER),
            ),
            'invoiceRecipientName' => $this->input('invoiceRecipientName', $this->input('invoice_recipient_name')),
            'reconciliationNote' => $this->input('reconciliationNote', $this->input('reconciliation_note')),
            'adjustments' => $adjustments,
        ]);
    }

    public function rules(): array
    {
        return [
            'reconciliationResult' => ['required', Rule::in([
                ProjectCost::RECONCILIATION_MATCHED,
                ProjectCost::RECONCILIATION_MATCHED_WITH_NOTE,
                ProjectCost::RECONCILIATION_DIFFERENCE,
                ProjectCost::RECONCILIATION_PENDING_DOCUMENTS,
                ProjectCost::RECONCILIATION_CANCELLED,
            ])],
            'invoiceStatus' => ['required', Rule::in([
                ProjectCost::INVOICE_STATUS_PENDING,
                ProjectCost::INVOICE_STATUS_WAITING,
                ProjectCost::INVOICE_STATUS_RECEIVED,
                ProjectCost::INVOICE_STATUS_NOT_REQUIRED,
            ])],
            'invoiceNumber' => [
                'nullable',
                'required_if:invoiceStatus,'.ProjectCost::INVOICE_STATUS_RECEIVED,
                'string',
                'max:100',
            ],
            'invoiceRecipientType' => ['required', Rule::in([
                ProjectCost::INVOICE_RECIPIENT_CUSTOMER,
                ProjectCost::INVOICE_RECIPIENT_COMPANY,
                ProjectCost::INVOICE_RECIPIENT_OTHER,
            ])],
            'invoiceRecipientName' => [
                'nullable',
                'required_if:invoiceRecipientType,'.ProjectCost::INVOICE_RECIPIENT_OTHER,
                'string',
                'max:255',
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
            'invoiceNumber.required_if' => 'Vui lòng nhập số hóa đơn khi đã nhận hóa đơn.',
            'invoiceNumber.max' => 'Số hóa đơn không được vượt quá 100 ký tự.',
            'invoiceRecipientName.required_if' => 'Vui lòng nhập chủ thể nhận hóa đơn.',
            'adjustments.*.adjustmentType.required' => 'Vui lòng chọn loại xử lý số dư.',
            'adjustments.*.amount.min' => 'Số tiền xử lý phải lớn hơn 0.',
        ];
    }
}
