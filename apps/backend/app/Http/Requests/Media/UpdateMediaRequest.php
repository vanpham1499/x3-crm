<?php

namespace App\Http\Requests\Media;

use App\Http\Requests\BaseRequest;

class UpdateMediaRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
        ];
    }
}
