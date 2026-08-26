<?php

namespace App\Http\Requests\ProjectCosts;

use App\Http\Requests\BaseRequest;

class ReportProjectCostCidIncidentRequest extends BaseRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'stoppedAt' => $this->input('stoppedAt', $this->input('stopped_at')),
            'refundedAmount' => $this->input('refundedAmount', $this->input('refunded_amount')),
        ]);
    }

    public function rules(): array
    {
        return [
            'stoppedAt' => ['required', 'date', 'before_or_equal:today'],
            'refundedAmount' => ['required', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'stoppedAt.required' => 'Vui lòng chọn ngày CID ngừng hoạt động.',
            'stoppedAt.before_or_equal' => 'Ngày CID ngừng không được nằm trong tương lai.',
            'refundedAmount.required' => 'Vui lòng nhập số tiền CID hoàn về.',
            'refundedAmount.min' => 'Số tiền CID hoàn về không được nhỏ hơn 0.',
        ];
    }
}
