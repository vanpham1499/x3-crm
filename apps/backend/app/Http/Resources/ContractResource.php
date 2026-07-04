<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContractResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'projectId' => $this->project_id,
            'contractNo' => $this->contract_no,
            'contractStatusId' => $this->contract_status_id,
            'contractStatusOptionId' => $this->contract_status_option_id,
            'depositAmount' => $this->deposit_amount,
            'signedDate' => $this->signed_date?->toDateString(),
            'expiredDate' => $this->expired_date?->toDateString(),
            'contractMonth' => $this->contract_month,
            'fileUrl' => $this->file_url,
            'note' => $this->note,
            'contractStatusOption' => $this->whenLoaded('contractStatusOption', fn () => $this->contractStatusOption ? new OptionResource($this->contractStatusOption) : null),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
                'customer' => $this->project->relationLoaded('customer') && $this->project->customer ? [
                    'id' => $this->project->customer->id,
                    'customerCode' => $this->project->customer->customer_code,
                    'customerName' => $this->project->customer->customer_name,
                ] : null,
                'service' => $this->project->relationLoaded('service') && $this->project->service ? [
                    'id' => $this->project->service->id,
                    'code' => $this->project->service->code,
                    'name' => $this->project->service->name,
                ] : null,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
