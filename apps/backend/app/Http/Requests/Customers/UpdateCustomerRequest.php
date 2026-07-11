<?php

namespace App\Http\Requests\Customers;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use Illuminate\Validation\Rule;

class UpdateCustomerRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'customer_code' => ['sometimes', 'nullable', 'string', 'max:50', Rule::unique('customers', 'customer_code')->ignore($this->route('id'))->whereNull('deleted_at')],
            'customerCode' => ['sometimes', 'nullable', 'string', 'max:50', Rule::unique('customers', 'customer_code')->ignore($this->route('id'))->whereNull('deleted_at')],
            'lead_id' => ['sometimes', 'nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'leadId' => ['sometimes', 'nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'customer_name' => ['sometimes', 'string', 'max:255'],
            'customerName' => ['sometimes', 'string', 'max:255'],
            'customer_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'customerType' => ['sometimes', 'nullable', 'string', 'max:50'],
            'customer_type_option_id' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_CUSTOMER_TYPE)->whereNull('deleted_at')],
            'customerTypeOptionId' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_CUSTOMER_TYPE)->whereNull('deleted_at')],
            'company_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'companyName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'representative_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'representativeName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tax_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'taxCode' => ['sometimes', 'nullable', 'string', 'max:100'],
            'identity_no' => ['sometimes', 'nullable', 'string', 'max:100'],
            'identityNo' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'website' => ['sometimes', 'nullable', 'string', 'max:255'],
            'industry' => ['sometimes', 'nullable', 'string', 'max:255'],
            'industry_option_id' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_INDUSTRY)->whereNull('deleted_at')],
            'industryOptionId' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_INDUSTRY)->whereNull('deleted_at')],
            'birthday' => ['sometimes', 'nullable', 'date'],
            'source_option_id' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SOURCE)->whereNull('deleted_at')],
            'sourceOptionId' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SOURCE)->whereNull('deleted_at')],
            'sales_user_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'salesUserId' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'note' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
