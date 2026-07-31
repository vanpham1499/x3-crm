<?php

namespace App\Http\Requests\WeeklyReports;

use App\Http\Requests\BaseRequest;

class RejectWeeklyReportRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'max:2000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'reason' => 'lý do từ chối',
        ];
    }
}
