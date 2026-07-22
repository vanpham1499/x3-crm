<?php

namespace App\Http\Requests\ProjectCosts;

class UpdateProjectCostRequest extends CreateProjectCostRequest
{
    public function rules(): array
    {
        $rules = parent::rules();

        foreach (['project_id', 'projectId', 'entry_type', 'entryType'] as $field) {
            $rules[$field] = [
                'sometimes',
                ...array_values(array_filter(
                    $rules[$field],
                    fn (mixed $rule): bool => ! is_string($rule) || ! str_starts_with($rule, 'required_without:'),
                )),
            ];
        }

        return $rules;
    }
}
