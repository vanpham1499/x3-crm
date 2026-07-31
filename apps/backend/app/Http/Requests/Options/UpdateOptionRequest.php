<?php

namespace App\Http\Requests\Options;

use App\Http\Requests\BaseRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UpdateOptionRequest extends BaseRequest
{
    public function rules(): array
    {
        $group = $this->input('group') ?: DB::table('options')->where('id', $this->route('id'))->value('group');

        return [
            'group' => ['sometimes', 'string', 'max:100'],
            'key' => [
                'sometimes',
                'nullable',
                'string',
                'max:100',
                Rule::unique('options', 'key')->ignore($this->route('id'))->where('group', $group)->whereNull('deleted_at'),
            ],
            'value' => ['sometimes', 'nullable', 'string', 'max:255'],
            'label' => ['sometimes', 'string', 'max:255'],
            'meta' => ['sometimes', 'nullable', 'array'],
            'meta.color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'meta.requiresWeeklyReport' => ['nullable', 'boolean'],
            'meta.serviceRootIds' => ['nullable', 'array', 'min:2'],
            'meta.serviceRootIds.*' => [
                'integer',
                'distinct',
                Rule::exists('services', 'id')->where(fn ($query) => $query
                    ->whereNull('parent_id')
                    ->whereNull('deleted_at')),
            ],
            'sort_order' => ['sometimes', 'nullable', 'integer'],
            'sortOrder' => ['sometimes', 'nullable', 'integer'],
            'is_active' => ['sometimes', 'nullable', 'boolean'],
            'isActive' => ['sometimes', 'nullable', 'boolean'],
        ];
    }
}
