<?php

namespace App\Http\Requests\Kpi;

use App\Http\Requests\BaseRequest;

class GetKpiReportRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'period' => ['nullable', 'date_format:Y-m'],
            'period_from' => ['nullable', 'date_format:Y-m'],
            'period_to' => ['nullable', 'date_format:Y-m'],
        ];
    }
}
