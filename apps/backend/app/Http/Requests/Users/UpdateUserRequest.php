<?php

namespace App\Http\Requests\Users;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'avatar' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'role' => [
                'sometimes',
                'string',
                'max:50',
                Rule::exists('roles', 'name')->whereNull('deleted_at'),
            ],
            'isActive' => ['sometimes', 'boolean'],
        ];
    }
}
