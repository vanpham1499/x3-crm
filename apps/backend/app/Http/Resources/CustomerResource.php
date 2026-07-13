<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'customerCode' => $this->customer_code,
            'leadId' => $this->lead_id,
            'customerName' => $this->customer_name,
            'customerType' => $this->customer_type,
            'customerTypeOptionId' => $this->customer_type_option_id,
            'companyName' => $this->company_name,
            'representativeName' => $this->representative_name,
            'taxCode' => $this->tax_code,
            'identityNo' => $this->identity_no,
            'address' => $this->address,
            'phone' => $this->phone,
            'email' => $this->email,
            'website' => $this->website,
            'industry' => $this->industry,
            'industryOptionId' => $this->industry_option_id,
            'birthday' => $this->birthday?->toDateString(),
            'sourceOptionId' => $this->source_option_id,
            'salesUserId' => $this->sales_user_id,
            'note' => $this->note,
            'lead' => $this->whenLoaded('lead', fn () => $this->lead ? [
                'id' => $this->lead->id,
                'leadCode' => $this->lead->lead_code,
                'customerName' => $this->lead->customer_name,
            ] : null),
            'customerTypeOption' => $this->whenLoaded('customerTypeOption', fn () => $this->customerTypeOption ? new OptionResource($this->customerTypeOption) : null),
            'sourceOption' => $this->whenLoaded('sourceOption', fn () => $this->sourceOption ? new OptionResource($this->sourceOption) : null),
            'industryOption' => $this->whenLoaded('industryOption', fn () => $this->industryOption ? new OptionResource($this->industryOption) : null),
            'salesUser' => $this->whenLoaded('salesUser', fn () => $this->salesUser ? [
                'id' => $this->salesUser->id,
                'code' => $this->salesUser->code,
                'name' => $this->salesUser->name,
                'email' => $this->salesUser->email,
            ] : null),
            'projectsCount' => $this->whenLoaded('projects', fn () => $this->projects->count()),
            'timelines' => CustomerTimelineResource::collection($this->whenLoaded('timelines')),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
