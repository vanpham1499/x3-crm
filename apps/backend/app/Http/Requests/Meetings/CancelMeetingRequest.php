<?php

namespace App\Http\Requests\Meetings;

use App\Http\Requests\BaseRequest;

class CancelMeetingRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'max:2000'],
        ];
    }
}
