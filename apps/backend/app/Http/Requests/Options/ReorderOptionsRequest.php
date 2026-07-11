<?php

namespace App\Http\Requests\Options;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class ReorderOptionsRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'group' => ['required', 'string', 'max:100'],
            'optionIds' => ['required', 'array', 'min:1'],
            'optionIds.*' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('options', 'id')
                    ->where('group', $this->input('group'))
                    ->whereNull('deleted_at'),
            ],
        ];
    }
}
