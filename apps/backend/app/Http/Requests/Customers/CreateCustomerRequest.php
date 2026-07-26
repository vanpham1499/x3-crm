<?php

namespace App\Http\Requests\Customers;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use Illuminate\Validation\Rule;

class CreateCustomerRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'customer_code' => ['nullable', 'string', 'max:50', Rule::unique('customers', 'customer_code')],
            'customerCode' => ['nullable', 'string', 'max:50', Rule::unique('customers', 'customer_code')],
            'lead_id' => ['nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'leadId' => ['nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'customer_name' => ['required_without:customerName', 'string', 'max:255', 'not_regex:/\s/u'],
            'customerName' => ['required_without:customer_name', 'string', 'max:255', 'not_regex:/\s/u'],
            'customer_type' => ['nullable', 'string', 'max:50'],
            'customerType' => ['nullable', 'string', 'max:50'],
            'customer_type_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_CUSTOMER_TYPE)->whereNull('deleted_at')],
            'customerTypeOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_CUSTOMER_TYPE)->whereNull('deleted_at')],
            'company_name' => ['nullable', 'string', 'max:255'],
            'companyName' => ['required_without:company_name', 'string', 'max:255'],
            'representative_name' => ['nullable', 'string', 'max:255'],
            'representativeName' => ['nullable', 'string', 'max:255'],
            'tax_code' => ['nullable', 'string', 'max:100'],
            'taxCode' => ['required_without_all:tax_code,identity_no,identityNo', 'nullable', 'string', 'max:100'],
            'identity_no' => ['nullable', 'string', 'max:100'],
            'identityNo' => ['nullable', 'string', 'max:100'],
            'identity_image_urls' => ['nullable', 'array', 'max:3'],
            'identity_image_urls.*' => ['required', 'string', 'max:2048'],
            'identityImageUrls' => ['nullable', 'array', 'max:3'],
            'identityImageUrls.*' => ['required', 'string', 'max:2048'],
            'address' => ['required', 'string'],
            'phone' => ['required', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'invoice_email' => ['nullable', 'email', 'max:255'],
            'invoiceEmail' => ['nullable', 'email', 'max:255'],
            'website' => ['nullable', 'string', 'max:255'],
            'industry' => ['nullable', 'string', 'max:255'],
            'industry_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_INDUSTRY)->whereNull('deleted_at')],
            'industryOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_INDUSTRY)->whereNull('deleted_at')],
            'birthday' => ['nullable', 'date'],
            'source_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SOURCE)->whereNull('deleted_at')],
            'sourceOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SOURCE)->whereNull('deleted_at')],
            'sales_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'salesUserId' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'note' => ['nullable', 'string'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $normalized = [];

        foreach (['customer_code', 'customerCode', 'customer_name', 'customerName'] as $key) {
            if ($this->exists($key) && is_string($this->input($key))) {
                $normalized[$key] = trim($this->input($key));
            }
        }

        foreach (['company_name', 'companyName'] as $key) {
            if ($this->exists($key) && is_string($this->input($key))) {
                $normalized[$key] = mb_strtoupper(trim($this->input($key)), 'UTF-8');
            }
        }

        $this->merge($normalized);
    }

    public function messages(): array
    {
        return [
            'customer_name.not_regex' => 'Tên khách hàng không được chứa khoảng trắng.',
            'customerName.not_regex' => 'Tên khách hàng không được chứa khoảng trắng.',
        ];
    }
}
