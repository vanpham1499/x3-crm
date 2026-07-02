<?php

namespace App\Http\Requests\Media;

use App\Http\Requests\BaseRequest;

class UploadMediaRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:3072'],
        ];
    }
}
