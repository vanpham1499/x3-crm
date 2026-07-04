<?php

namespace App\Http\Requests\Contracts;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use Illuminate\Validation\Rule;

class UpdateContractRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'project_id' => ['sometimes', 'uuid', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['sometimes', 'uuid', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'contract_no' => ['sometimes', 'nullable', 'string', 'max:100'],
            'contractNo' => ['sometimes', 'nullable', 'string', 'max:100'],
            'contract_status_option_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_CONTRACT_STATUS)->whereNull('deleted_at')],
            'contractStatusOptionId' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_CONTRACT_STATUS)->whereNull('deleted_at')],
            'deposit_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'depositAmount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'signed_date' => ['sometimes', 'nullable', 'date'],
            'signedDate' => ['sometimes', 'nullable', 'date'],
            'expired_date' => ['sometimes', 'nullable', 'date'],
            'expiredDate' => ['sometimes', 'nullable', 'date'],
            'contract_month' => ['sometimes', 'nullable', 'string', 'max:20'],
            'contractMonth' => ['sometimes', 'nullable', 'string', 'max:20'],
            'file_url' => ['sometimes', 'nullable', 'string'],
            'fileUrl' => ['sometimes', 'nullable', 'string'],
            'note' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
