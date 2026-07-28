<?php

namespace App\Http\Requests\Meetings;

use App\Http\Requests\BaseRequest;

class CompleteMeetingRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'result' => ['required', 'string', 'max:10000'],
            'nextAction' => ['nullable', 'string', 'max:5000'],
            'nextActionDate' => ['nullable', 'date'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nextAction' => $this->input('nextAction', $this->input('next_action')),
            'nextActionDate' => $this->input('nextActionDate', $this->input('next_action_date')),
        ]);
    }
}
