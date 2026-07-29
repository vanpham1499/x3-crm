<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerLookupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'customerCode' => $this->customer_code,
            'leadId' => $this->lead_id,
            'customerName' => $this->customer_name,
            'companyName' => $this->company_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'salesUserId' => $this->sales_user_id,
            'salesUser' => $this->whenLoaded('salesUser', fn () => $this->salesUser ? [
                'id' => $this->salesUser->id,
                'code' => $this->salesUser->code,
                'name' => $this->salesUser->name,
                'email' => $this->salesUser->email,
                'departmentId' => $this->salesUser->department_id,
            ] : null),
        ];
    }
}
