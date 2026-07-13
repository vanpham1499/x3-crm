<?php

namespace App\Http\Requests\Payments;

class UpdatePaymentRequest extends CreatePaymentRequest
{
    public function rules(): array
    {
        return collect(parent::rules())
            ->map(fn (array $rules): array => array_values(array_map(
                fn ($rule) => is_string($rule) && str_starts_with($rule, 'required') ? 'sometimes' : $rule,
                $rules
            )))
            ->all();
    }
}
