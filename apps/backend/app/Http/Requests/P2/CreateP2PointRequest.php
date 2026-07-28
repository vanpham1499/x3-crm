<?php

namespace App\Http\Requests\P2;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use App\Models\P2Point;
use Illuminate\Validation\Rule;

class CreateP2PointRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'user_id' => ['required_without:userId', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'userId' => ['required_without:user_id', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'entry_date' => ['required_without:entryDate', 'date'],
            'entryDate' => ['required_without:entry_date', 'date'],
            'category' => [
                'required',
                'string',
                Rule::exists('options', 'key')->where(function ($query): void {
                    $query->where('group', Option::GROUP_P2_CATEGORY)->whereNull('deleted_at');
                }),
            ],
            'type' => ['nullable', 'string', Rule::in([P2Point::TYPE_BONUS, P2Point::TYPE_PENALTY])],
            'score' => ['required', 'numeric'],
            'customer_ref' => ['nullable', 'string', 'max:255'],
            'customerRef' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'is_approved' => ['nullable', 'boolean'],
            'isApproved' => ['nullable', 'boolean'],
        ];
    }
}
