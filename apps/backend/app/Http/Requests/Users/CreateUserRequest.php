<?php

namespace App\Http\Requests\Users;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateUserRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:50'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:6'],
            'phone' => ['nullable', 'string', 'max:50'],
            'avatar' => ['nullable', 'string', 'max:2048'],
            'role' => [
                'required',
                'string',
                'max:50',
                Rule::exists('roles', 'name')->whereNull('deleted_at'),
            ],
        ];
    }
}
