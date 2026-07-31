<?php

namespace App\Http\Requests\WeeklyReports;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateWeeklyReportMessageRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'content' => ['required', 'string', 'max:5000'],
            'reply_to_message_id' => [
                'nullable',
                'integer',
                Rule::exists('weekly_report_items', 'id')->whereNull('deleted_at'),
            ],
            'replyToMessageId' => [
                'nullable',
                'integer',
                Rule::exists('weekly_report_items', 'id')->whereNull('deleted_at'),
            ],
        ];
    }
}
