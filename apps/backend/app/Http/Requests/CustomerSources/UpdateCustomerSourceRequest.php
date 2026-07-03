<?php

namespace App\Http\Requests\CustomerSources;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class UpdateCustomerSourceRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('customer_sources', 'name')->ignore($this->route('id'))->whereNull('deleted_at'),
            ],
        ];
    }
}
