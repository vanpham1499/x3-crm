<?php

namespace App\Http\Resources;

use App\Models\Meeting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MeetingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isOverdue = in_array($this->status, Meeting::ACTIVE_STATUSES, true)
            && $this->ends_at?->isPast();

        return [
            'id' => $this->id,
            'meetingCode' => $this->meeting_code,
            'leadId' => $this->lead_id,
            'customerId' => $this->customer_id,
            'projectId' => $this->project_id,
            'organizerUserId' => $this->organizer_user_id,
            'subject' => $this->subject,
            'meetingType' => $this->meeting_type,
            'startsAt' => $this->starts_at?->toISOString(),
            'endsAt' => $this->ends_at?->toISOString(),
            'timezone' => $this->timezone,
            'location' => $this->location,
            'meetingUrl' => $this->meeting_url,
            'status' => $this->status,
            'isOverdue' => $isOverdue,
            'agenda' => $this->agenda,
            'result' => $this->result,
            'nextAction' => $this->next_action,
            'nextActionDate' => $this->next_action_date?->toDateString(),
            'cancellationReason' => $this->cancellation_reason,
            'completedAt' => $this->completed_at?->toISOString(),
            'cancelledAt' => $this->cancelled_at?->toISOString(),
            'relatedType' => $this->project_id ? 'project' : ($this->customer_id ? 'customer' : 'lead'),
            'lead' => $this->whenLoaded('lead', fn () => $this->lead ? [
                'id' => $this->lead->id,
                'leadCode' => $this->lead->lead_code,
                'customerName' => $this->lead->customer_name,
                'assignedUserId' => $this->lead->assigned_user_id,
            ] : null),
            'customer' => $this->whenLoaded('customer', fn () => $this->customer ? [
                'id' => $this->customer->id,
                'customerCode' => $this->customer->customer_code,
                'customerName' => $this->customer->customer_name,
                'salesUserId' => $this->customer->sales_user_id,
            ] : null),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
                'managerUserId' => $this->project->manager_user_id,
                'salesUserId' => $this->project->sales_user_id,
            ] : null),
            'organizer' => $this->whenLoaded('organizer', fn () => $this->organizer ? [
                'id' => $this->organizer->id,
                'code' => $this->organizer->code,
                'name' => $this->organizer->name,
                'departmentId' => $this->organizer->department_id,
                'department' => $this->organizer->relationLoaded('department') && $this->organizer->department ? [
                    'id' => $this->organizer->department->id,
                    'name' => $this->organizer->department->name,
                ] : null,
            ] : null),
            'participants' => $this->whenLoaded('participants', fn () => $this->participants->map(fn ($participant) => [
                'id' => $participant->id,
                'code' => $participant->code,
                'name' => $participant->name,
                'departmentId' => $participant->department_id,
                'attendanceStatus' => $participant->pivot?->attendance_status,
            ])->values()),
            'guests' => $this->whenLoaded('guests', fn () => $this->guests->map(fn ($guest) => [
                'id' => $guest->id,
                'name' => $guest->name,
                'email' => $guest->email,
                'phone' => $guest->phone,
                'attendanceStatus' => $guest->attendance_status,
            ])->values()),
            'histories' => $this->whenLoaded('histories', fn () => $this->histories->map(fn ($history) => [
                'id' => $history->id,
                'action' => $history->action,
                'payload' => $history->payload,
                'actor' => $history->relationLoaded('actor') && $history->actor ? [
                    'id' => $history->actor->id,
                    'code' => $history->actor->code,
                    'name' => $history->actor->name,
                ] : null,
                'createdAt' => $history->created_at?->toISOString(),
            ])->values()),
            'canUpdate' => $request->user()?->can('update', $this->resource) ?? false,
            'canDelete' => $request->user()?->can('delete', $this->resource) ?? false,
            'createdBy' => $this->whenLoaded('createdBy', fn () => $this->createdBy ? [
                'id' => $this->createdBy->id,
                'code' => $this->createdBy->code,
                'name' => $this->createdBy->name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
