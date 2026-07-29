<?php

namespace App\Http\Requests\Roles;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class UpdateRoleRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('roles', 'name')->ignore($this->route('id'))->whereNull('deleted_at'),
            ],
            'description' => ['sometimes', 'nullable', 'string'],
            'permission_ids' => ['sometimes', 'array'],
            'permission_ids.*' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('permissions', 'id')->whereNull('deleted_at'),
            ],
        ];
    }
}
