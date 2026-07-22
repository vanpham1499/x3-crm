<?php

namespace App\Http\Requests\Services;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class ReorderServicesRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'parentId' => [
                'present',
                'nullable',
                'integer',
                Rule::exists('services', 'id')->whereNull('deleted_at'),
            ],
            'serviceIds' => ['required', 'array', 'min:1'],
            'serviceIds.*' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('services', 'id')->whereNull('deleted_at'),
            ],
        ];
    }
}
