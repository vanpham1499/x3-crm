<?php

namespace App\Http\Requests\CustomerSources;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateCustomerSourceRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('customer_sources', 'name')->whereNull('deleted_at')],
        ];
    }
}
