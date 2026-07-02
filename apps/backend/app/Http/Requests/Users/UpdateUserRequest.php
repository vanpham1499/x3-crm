<?php

namespace App\Http\Requests\Users;

use App\Http\Requests\BaseRequest;
use App\Models\User;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'role' => ['sometimes', Rule::in(User::ROLES)],
            'isActive' => ['sometimes', 'boolean'],
        ];
    }
}
