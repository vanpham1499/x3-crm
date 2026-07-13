<?php

namespace App\Http\Requests\WeeklyReports;

use App\Http\Requests\BaseRequest;

class UploadWeeklyReportAttachmentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'mimes:jpeg,jpg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv,zip',
                'max:10240',
            ],
        ];
    }
}
