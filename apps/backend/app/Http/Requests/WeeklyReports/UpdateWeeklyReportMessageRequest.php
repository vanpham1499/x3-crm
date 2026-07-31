<?php

namespace App\Http\Requests\WeeklyReports;

use App\Http\Requests\BaseRequest;

class UpdateWeeklyReportMessageRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'content' => ['required', 'string', 'max:5000'],
        ];
    }
}
