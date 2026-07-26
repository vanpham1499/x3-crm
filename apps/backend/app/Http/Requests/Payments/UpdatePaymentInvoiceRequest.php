<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;

class UpdatePaymentInvoiceRequest extends BaseRequest
{
    protected function prepareForValidation(): void
    {
        $input = $this->all();

        if (
            ! array_key_exists('invoiceNumber', $input)
            && ! array_key_exists('output_invoice_number', $input)
        ) {
            return;
        }

        $invoiceNumber = $this->input('invoiceNumber', $this->input('output_invoice_number'));

        $this->merge([
            'invoiceNumber' => is_string($invoiceNumber) ? trim($invoiceNumber) : $invoiceNumber,
        ]);
    }

    public function rules(): array
    {
        return [
            'invoiceNumber' => ['present', 'nullable', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'invoiceNumber.present' => 'Vui lòng gửi số hóa đơn.',
            'invoiceNumber.string' => 'Số hóa đơn phải là chuỗi ký tự.',
            'invoiceNumber.max' => 'Số hóa đơn không được vượt quá 100 ký tự.',
        ];
    }
}
