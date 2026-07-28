<?php

namespace App\Http\Requests\Meetings;

use App\Http\Requests\BaseRequest;
use App\Models\Meeting;
use Illuminate\Validation\Rule;

class CreateMeetingRequest extends BaseRequest
{
    public function rules(): array
    {
        $activeRecord = fn ($query) => $query->whereNull('deleted_at');
        $activeUser = fn ($query) => $query->whereNull('deleted_at')->where('is_active', true);

        return [
            'leadId' => [
                'nullable',
                'integer',
                'required_without_all:customerId,projectId',
                Rule::exists('leads', 'id')->where($activeRecord),
            ],
            'customerId' => [
                'nullable',
                'integer',
                'required_without_all:leadId,projectId',
                Rule::exists('customers', 'id')->where($activeRecord),
            ],
            'projectId' => [
                'nullable',
                'integer',
                'required_without_all:leadId,customerId',
                Rule::exists('projects', 'id')->where($activeRecord),
            ],
            'organizerUserId' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where($activeUser),
            ],
            'subject' => ['required', 'string', 'max:255'],
            'meetingType' => ['required', Rule::in(Meeting::MEETING_TYPES)],
            'startsAt' => ['required', 'date'],
            'endsAt' => ['required', 'date', 'after:startsAt'],
            'timezone' => ['nullable', 'string', 'max:50'],
            'location' => ['nullable', 'string', 'max:500'],
            'meetingUrl' => ['nullable', 'url:http,https', 'max:1000'],
            'agenda' => ['nullable', 'string', 'max:10000'],
            'participantUserIds' => ['nullable', 'array'],
            'participantUserIds.*' => [
                'integer',
                'distinct',
                Rule::exists('users', 'id')->where($activeUser),
            ],
            'guests' => ['nullable', 'array'],
            'guests.*.name' => ['required', 'string', 'max:150'],
            'guests.*.email' => ['nullable', 'email', 'max:255'],
            'guests.*.phone' => ['nullable', 'string', 'max:30'],
            'allowConflict' => ['nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $map = [
            'lead_id' => 'leadId',
            'customer_id' => 'customerId',
            'project_id' => 'projectId',
            'organizer_user_id' => 'organizerUserId',
            'meeting_type' => 'meetingType',
            'starts_at' => 'startsAt',
            'ends_at' => 'endsAt',
            'meeting_url' => 'meetingUrl',
            'participant_user_ids' => 'participantUserIds',
            'allow_conflict' => 'allowConflict',
        ];
        $values = [];

        foreach ($map as $snake => $camel) {
            if (! $this->exists($camel) && $this->exists($snake)) {
                $values[$camel] = $this->input($snake);
            }
        }

        if ($values !== []) {
            $this->merge($values);
        }
    }
}
