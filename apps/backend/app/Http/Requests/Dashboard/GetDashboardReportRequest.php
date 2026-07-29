<?php

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\BaseRequest;

class GetDashboardReportRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'period_from' => ['nullable', 'date_format:Y-m'],
            'period_to' => ['nullable', 'date_format:Y-m'],
        ];
    }
}
