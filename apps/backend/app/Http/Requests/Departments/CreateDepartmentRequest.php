<?php

namespace App\Http\Requests\Departments;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateDepartmentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('departments', 'name')->whereNull('deleted_at'),
            ],
            'leaderUserId' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->whereNull('deleted_at'),
                Rule::unique('departments', 'leader_user_id')->whereNull('deleted_at'),
            ],
            'memberUserIds' => ['nullable', 'array'],
            'memberUserIds.*' => [
                'integer',
                'distinct',
                Rule::exists('users', 'id')->whereNull('deleted_at'),
            ],
        ];
    }
}
