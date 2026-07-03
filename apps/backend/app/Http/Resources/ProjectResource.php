<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'projectCode' => $this->project_code,
            'customerId' => $this->customer_id,
            'serviceId' => $this->service_id,
            'projectName' => $this->project_name,
            'statusId' => $this->status_id,
            'statusOptionId' => $this->status_option_id,
            'managerUserId' => $this->manager_user_id,
            'salesUserId' => $this->sales_user_id,
            'zaloGroup' => $this->zalo_group,
            'planLink' => $this->plan_link,
            'startDate' => $this->start_date?->toDateString(),
            'endDate' => $this->end_date?->toDateString(),
            'note' => $this->note,
            'customer' => $this->whenLoaded('customer', fn () => $this->customer ? [
                'id' => $this->customer->id,
                'customerCode' => $this->customer->customer_code,
                'customerName' => $this->customer->customer_name,
                'companyName' => $this->customer->company_name,
                'phone' => $this->customer->phone,
                'email' => $this->customer->email,
            ] : null),
            'service' => $this->whenLoaded('service', fn () => $this->service ? new ServiceResource($this->service) : null),
            'statusOption' => $this->whenLoaded('statusOption', fn () => $this->statusOption ? new OptionResource($this->statusOption) : null),
            'managerUser' => $this->whenLoaded('managerUser', fn () => $this->managerUser ? [
                'id' => $this->managerUser->id,
                'code' => $this->managerUser->code,
                'name' => $this->managerUser->name,
                'email' => $this->managerUser->email,
            ] : null),
            'salesUser' => $this->whenLoaded('salesUser', fn () => $this->salesUser ? [
                'id' => $this->salesUser->id,
                'code' => $this->salesUser->code,
                'name' => $this->salesUser->name,
                'email' => $this->salesUser->email,
            ] : null),
            'timelines' => CustomerTimelineResource::collection($this->whenLoaded('timelines')),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
