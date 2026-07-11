<?php

namespace App\Http\Requests\Revenues;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateRevenueRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'project_id' => ['required_without:projectId', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['required_without:project_id', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'revenue_code' => ['nullable', 'string', 'max:100', Rule::unique('revenues', 'revenue_code')->whereNull('deleted_at')],
            'revenueCode' => ['nullable', 'string', 'max:100', Rule::unique('revenues', 'revenue_code')->whereNull('deleted_at')],
            'revenue_type' => ['nullable', 'string', 'max:50'],
            'revenueType' => ['nullable', 'string', 'max:50'],
            'reported_date' => ['nullable', 'date'],
            'reportedDate' => ['nullable', 'date'],
            'payment_due_date' => ['nullable', 'date'],
            'paymentDueDate' => ['nullable', 'date'],
            'paid_date' => ['nullable', 'date'],
            'paidDate' => ['nullable', 'date'],
            'revenue_month' => ['nullable', 'date'],
            'revenueMonth' => ['nullable', 'date'],
            'amount_before_vat' => ['nullable', 'numeric', 'min:0'],
            'amountBeforeVat' => ['nullable', 'numeric', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0'],
            'vatRate' => ['nullable', 'numeric', 'min:0'],
            'vat_amount' => ['nullable', 'numeric', 'min:0'],
            'vatAmount' => ['nullable', 'numeric', 'min:0'],
            'amount_after_vat' => ['nullable', 'numeric', 'min:0'],
            'amountAfterVat' => ['nullable', 'numeric', 'min:0'],
            'actual_received_amount' => ['nullable', 'numeric', 'min:0'],
            'actualReceivedAmount' => ['nullable', 'numeric', 'min:0'],
            'payment_status' => ['nullable', 'string', Rule::in(['unpaid', 'partial', 'paid'])],
            'paymentStatus' => ['nullable', 'string', Rule::in(['unpaid', 'partial', 'paid'])],
            'invoice_status' => ['nullable', 'string', Rule::in(['not_issued', 'issued'])],
            'invoiceStatus' => ['nullable', 'string', Rule::in(['not_issued', 'issued'])],
            'note' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
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
