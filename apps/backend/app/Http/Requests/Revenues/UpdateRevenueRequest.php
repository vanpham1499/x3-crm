<?php

namespace App\Http\Requests\Revenues;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class UpdateRevenueRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'project_id' => ['sometimes', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['sometimes', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'revenue_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'revenueCode' => ['sometimes', 'nullable', 'string', 'max:100'],
            'revenue_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'revenueType' => ['sometimes', 'nullable', 'string', 'max:50'],
            'reported_date' => ['sometimes', 'nullable', 'date'],
            'reportedDate' => ['sometimes', 'nullable', 'date'],
            'payment_due_date' => ['sometimes', 'nullable', 'date'],
            'paymentDueDate' => ['sometimes', 'nullable', 'date'],
            'paid_date' => ['sometimes', 'nullable', 'date'],
            'paidDate' => ['sometimes', 'nullable', 'date'],
            'revenue_month' => ['sometimes', 'nullable', 'date'],
            'revenueMonth' => ['sometimes', 'nullable', 'date'],
            'amount_before_vat' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'amountBeforeVat' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vat_rate' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vatRate' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vat_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vatAmount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'amount_after_vat' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'amountAfterVat' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'actual_received_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'actualReceivedAmount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'payment_status' => ['sometimes', 'nullable', 'string', Rule::in(['unpaid', 'partial', 'paid'])],
            'paymentStatus' => ['sometimes', 'nullable', 'string', Rule::in(['unpaid', 'partial', 'paid'])],
            'invoice_status' => ['sometimes', 'nullable', 'string', Rule::in(['not_issued', 'issued'])],
            'invoiceStatus' => ['sometimes', 'nullable', 'string', Rule::in(['not_issued', 'issued'])],
            'note' => ['sometimes', 'nullable', 'string'],
            'items' => ['sometimes', 'nullable', 'array'],
            'items.*.service_id' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'items.*.serviceId' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'items.*.item_name' => ['required_with:items', 'string', 'max:255'],
            'items.*.itemName' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.unitPrice' => ['nullable', 'numeric', 'min:0'],
            'items.*.amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.note' => ['nullable', 'string'],
        ];
    }
}
