<?php

namespace App\Http\Requests\Departments;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class UpdateDepartmentRequest extends BaseRequest
{
    public function rules(): array
    {
        $departmentId = $this->route('id');

        return [
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('departments', 'name')->ignore($departmentId)->whereNull('deleted_at'),
            ],
            'leaderUserId' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->whereNull('deleted_at'),
                Rule::unique('departments', 'leader_user_id')
                    ->ignore($departmentId)
                    ->whereNull('deleted_at'),
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
