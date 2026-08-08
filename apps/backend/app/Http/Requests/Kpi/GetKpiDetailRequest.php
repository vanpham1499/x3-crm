<?php

namespace App\Http\Requests\Kpi;

use App\Http\Requests\BaseRequest;
use App\Models\KpiTarget;
use Illuminate\Validation\Rule;

class GetKpiDetailRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'period' => ['required', 'date_format:Y-m'],
            'scope_type' => ['required', Rule::in(KpiTarget::SCOPES)],
            'scope_id' => ['required', 'integer', 'min:1'],
        ];
    }
}
