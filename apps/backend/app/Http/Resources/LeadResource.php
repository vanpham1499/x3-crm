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
            'statusOptionId' => $this->status_option_id,
            'occurredDate' => $this->occurred_date?->toDateString(),
            'assignedUserId' => $this->assigned_user_id,
            'sourceOptionId' => $this->source_option_id,
            'industryOptionId' => $this->industry_option_id,
            'interestedServiceOptionId' => $this->interested_service_option_id,
            'interestedServiceOptionIds' => $this->whenLoaded('interestedServiceOptions', fn () => $this->interestedServiceOptions->pluck('id')->values()),
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
            'statusOption' => $this->whenLoaded('statusOption', fn () => $this->statusOption ? new OptionResource($this->statusOption) : null),
            'assignedUser' => $this->whenLoaded('assignedUser', fn () => $this->assignedUser ? [
                'id' => $this->assignedUser->id,
                'code' => $this->assignedUser->code,
                'name' => $this->assignedUser->name,
                'email' => $this->assignedUser->email,
            ] : null),
            'createdBy' => $this->whenLoaded('createdBy', fn () => $this->createdBy ? [
                'id' => $this->createdBy->id,
                'code' => $this->createdBy->code,
                'name' => $this->createdBy->name,
                'email' => $this->createdBy->email,
            ] : null),
            'sourceOption' => $this->whenLoaded('sourceOption', fn () => $this->sourceOption ? new OptionResource($this->sourceOption) : null),
            'industryOption' => $this->whenLoaded('industryOption', fn () => $this->industryOption ? new OptionResource($this->industryOption) : null),
            'interestedServiceOption' => $this->whenLoaded('interestedServiceOption', fn () => $this->interestedServiceOption ? new OptionResource($this->interestedServiceOption) : null),
            'interestedServiceOptions' => OptionResource::collection($this->whenLoaded('interestedServiceOptions')),
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
            'timelines' => CustomerTimelineResource::collection($this->whenLoaded('timelines')),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
