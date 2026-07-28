<?php

namespace App\Http\Requests\Kpi;

use App\Http\Requests\BaseRequest;
use App\Models\KpiTarget;
use Illuminate\Validation\Rule;

class UpsertKpiTargetRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'period' => ['required', 'date_format:Y-m'],
            'scopeType' => ['required', Rule::in(KpiTarget::SCOPES)],
            'scopeId' => ['required', 'integer', 'min:1'],
            'targetAmount' => ['required', 'numeric', 'min:0', 'max:9999999999999999.99'],
        ];
    }
}
