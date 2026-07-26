<?php

namespace App\Http\Requests\ProjectCosts;

use App\Http\Requests\BaseRequest;

class ReportProjectCostCidIncidentRequest extends BaseRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'stoppedAt' => $this->input('stoppedAt', $this->input('stopped_at')),
            'spentAmount' => $this->input('spentAmount', $this->input('spent_amount')),
            'unrecoverableAmount' => $this->input(
                'unrecoverableAmount',
                $this->input('unrecoverable_amount', 0),
            ),
        ]);
    }

    public function rules(): array
    {
        return [
            'stoppedAt' => ['required', 'date', 'before_or_equal:today'],
            'spentAmount' => ['required', 'numeric', 'min:0'],
            'unrecoverableAmount' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'stoppedAt.required' => 'Vui lòng chọn ngày CID ngừng hoạt động.',
            'stoppedAt.before_or_equal' => 'Ngày CID ngừng không được nằm trong tương lai.',
            'spentAmount.required' => 'Vui lòng nhập số tiền CID đã chạy.',
            'spentAmount.min' => 'Số tiền đã chạy không được nhỏ hơn 0.',
            'unrecoverableAmount.min' => 'Số tiền không thu hồi được không được nhỏ hơn 0.',
        ];
    }
}
