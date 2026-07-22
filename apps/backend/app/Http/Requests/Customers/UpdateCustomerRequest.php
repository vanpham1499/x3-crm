<?php

namespace App\Http\Requests\Customers;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use Illuminate\Validation\Rule;

class UpdateCustomerRequest extends BaseRequest
{
    public function rules(): array
    {
        $customerId = $this->route('id');

        return [
            'customer_code' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('customers', 'customer_code')->ignore($customerId)],
            'customerCode' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('customers', 'customer_code')->ignore($customerId)],
            'lead_id' => ['sometimes', 'nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'leadId' => ['sometimes', 'nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'customer_name' => ['sometimes', 'string', 'max:255'],
            'customerName' => ['sometimes', 'string', 'max:255'],
            'customer_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'customerType' => ['sometimes', 'nullable', 'string', 'max:50'],
            'customer_type_option_id' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_CUSTOMER_TYPE)->whereNull('deleted_at')],
            'customerTypeOptionId' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_CUSTOMER_TYPE)->whereNull('deleted_at')],
            'company_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'companyName' => ['required_without:company_name', 'string', 'max:255'],
            'representative_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'representativeName' => ['required_without:representative_name', 'string', 'max:255'],
            'tax_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'taxCode' => ['required_without_all:tax_code,identity_no,identityNo', 'nullable', 'string', 'max:100'],
            'identity_no' => ['sometimes', 'nullable', 'string', 'max:100'],
            'identityNo' => ['sometimes', 'nullable', 'string', 'max:100'],
            'identity_image_urls' => ['sometimes', 'nullable', 'array', 'max:3'],
            'identity_image_urls.*' => ['required', 'string', 'max:2048'],
            'identityImageUrls' => ['sometimes', 'nullable', 'array', 'max:3'],
            'identityImageUrls.*' => ['required', 'string', 'max:2048'],
            'address' => ['required', 'string'],
            'phone' => ['required', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'invoice_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'invoiceEmail' => ['required_without:invoice_email', 'email', 'max:255'],
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

    protected function prepareForValidation(): void
    {
        $normalized = [];

        foreach (['customer_code', 'customerCode'] as $key) {
            if ($this->exists($key) && is_string($this->input($key))) {
                $normalized[$key] = trim($this->input($key));
            }
        }

        $this->merge($normalized);
    }
}
