<?php

namespace App\Http\Requests\Quotations;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class VoidQuotationRequest extends BaseRequest
{
    public function rules(): array
    {
        $execute = $this->route()?->getName() === 'quotations.void';

        return [
            'mode' => ['required', Rule::in(['release', 'transfer'])],
            'targetQuotationId' => ['nullable', 'required_if:mode,transfer', 'prohibited_if:mode,release', 'integer', 'min:1'],
            'reason' => [$execute ? 'required' : 'sometimes', 'string', 'min:5', 'max:2000'],
            'confirmationCode' => [$execute ? 'required' : 'sometimes', 'string', 'max:255'],
            'fingerprint' => [$execute ? 'required' : 'sometimes', 'string', 'size:64'],
            'requestId' => [$execute ? 'required' : 'sometimes', 'uuid'],
        ];
    }
}
