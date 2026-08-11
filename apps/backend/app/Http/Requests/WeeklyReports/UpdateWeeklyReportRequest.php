<?php

namespace App\Http\Requests\WeeklyReports;

class UpdateWeeklyReportRequest extends CreateWeeklyReportRequest
{
    public function rules(): array
    {
        $rules = collect(parent::rules())
            ->map(fn (array $rules): array => array_values(array_filter($rules, fn ($rule) => ! str_starts_with((string) $rule, 'required_without'))))
            ->all();

        $rules['weekly_condition'] = ['required_without:weeklyCondition', 'string', 'max:50'];
        $rules['weeklyCondition'] = ['required_without:weekly_condition', 'string', 'max:50'];

        return $rules;
    }
}
