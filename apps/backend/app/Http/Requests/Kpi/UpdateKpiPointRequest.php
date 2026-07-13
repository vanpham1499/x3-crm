<?php

namespace App\Http\Requests\Kpi;

class UpdateKpiPointRequest extends CreateKpiPointRequest
{
    public function rules(): array
    {
        return collect(parent::rules())
            ->map(fn (array $rules): array => array_values(array_map(
                fn ($rule) => in_array($rule, ['required', 'required_without:userId', 'required_without:user_id', 'required_without:entryDate', 'required_without:entry_date'], true) ? 'sometimes' : $rule,
                $rules
            )))
            ->all();
    }
}
