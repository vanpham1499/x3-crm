<?php

namespace App\Http\Requests\Roles;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateRoleRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100', Rule::unique('roles', 'name')->whereNull('deleted_at')],
            'description' => ['nullable', 'string'],
        ];
    }
}
