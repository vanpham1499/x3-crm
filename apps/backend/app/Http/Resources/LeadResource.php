<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'leadCode' => $this->lead_code,
            'customerName' => $this->customer_name,
            'statusId' => $this->status_id,
            'occurredDate' => $this->occurred_date?->toDateString(),
            'assignedUserId' => $this->assigned_user_id,
            'sourceId' => $this->source_id,
            'interestedServiceId' => $this->interested_service_id,
            'interestedServiceText' => $this->interested_service_text,
            'phone' => $this->phone,
            'website' => $this->website,
            'industry' => $this->industry,
            'planLink' => $this->plan_link,
            'zaloGroup' => $this->zalo_group,
            'note' => $this->note,
            'closedDate' => $this->closed_date?->toDateString(),
            'convertedCustomerId' => $this->converted_customer_id,
            'status' => $this->whenLoaded('status', fn () => [
                'id' => $this->status->id,
                'type' => $this->status->type,
                'name' => $this->status->name,
                'sortOrder' => $this->status->sort_order,
            ]),
            'assignedUser' => $this->whenLoaded('assignedUser', fn () => $this->assignedUser ? [
                'id' => $this->assignedUser->id,
                'code' => $this->assignedUser->code,
                'name' => $this->assignedUser->name,
                'email' => $this->assignedUser->email,
            ] : null),
            'source' => $this->whenLoaded('source', fn () => $this->source ? [
                'id' => $this->source->id,
                'name' => $this->source->name,
            ] : null),
            'interestedService' => $this->whenLoaded('interestedService', fn () => $this->interestedService ? [
                'id' => $this->interestedService->id,
                'code' => $this->interestedService->code,
                'name' => $this->interestedService->name,
                'level' => $this->interestedService->level,
            ] : null),
            'convertedCustomer' => $this->whenLoaded('convertedCustomer', fn () => $this->convertedCustomer ? [
                'id' => $this->convertedCustomer->id,
                'customerCode' => $this->convertedCustomer->customer_code,
                'customerName' => $this->convertedCustomer->customer_name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
