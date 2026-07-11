<?php

namespace App\Http\Requests\Roles;

use App\Http\Requests\BaseRequest;

class SyncRolePermissionsRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'permission_ids' => ['required', 'array'],
            'permission_ids.*' => ['required', 'integer', 'distinct', 'exists:permissions,id'],
        ];
    }
}
