<?php

namespace App\Http\Requests\WeeklyReports;

class UpdateWeeklyReportRequest extends CreateWeeklyReportRequest
{
    public function rules(): array
    {
        return collect(parent::rules())
            ->map(fn (array $rules): array => array_values(array_filter($rules, fn ($rule) => ! str_starts_with((string) $rule, 'required_without'))))
            ->all();
    }
}
