<?php

namespace App\Http\Requests\Payments;

class UpdatePaymentRequest extends CreatePaymentRequest
{
    public function rules(): array
    {
        return collect(parent::rules())
            ->map(fn (array $rules): array => array_values(array_map(
                fn ($rule) => in_array($rule, ['required', 'required_without:transactionDate', 'required_without:transaction_date'], true) ? 'sometimes' : $rule,
                $rules
            )))
            ->all();
    }
}
