<?php

namespace App\Http\Requests\Options;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateOptionRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'group' => ['required', 'string', 'max:100'],
            'key' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('options', 'key')->where('group', $this->input('group'))->whereNull('deleted_at'),
            ],
            'value' => ['nullable', 'string', 'max:255'],
            'label' => ['required', 'string', 'max:255'],
            'meta' => ['nullable', 'array'],
            'sort_order' => ['nullable', 'integer'],
            'sortOrder' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
            'isActive' => ['nullable', 'boolean'],
        ];
    }
}
