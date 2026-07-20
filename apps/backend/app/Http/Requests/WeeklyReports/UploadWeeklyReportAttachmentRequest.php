<?php

namespace App\Http\Requests\WeeklyReports;

use App\Http\Requests\BaseRequest;

class UploadWeeklyReportAttachmentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'file' => [
                'nullable',
                'required_without:media_url',
                'file',
                'mimes:jpeg,jpg,png,gif,webp',
                'max:3072',
            ],
            'media_url' => ['nullable', 'required_without:file', 'string', 'max:500'],
        ];
    }
}
