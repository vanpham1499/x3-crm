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
            'quotationId' => $this->quotation_id,
            'leadId' => $this->lead_id,
            'customerId' => $this->customer_id,
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
            ] : null),
            'quotation' => $this->whenLoaded('quotation', fn () => $this->quotation ? [
                'id' => $this->quotation->id,
                'quotationCode' => $this->quotation->quotation_code,
            ] : null),
            'customer' => $this->whenLoaded('customer', fn () => $this->customer ? [
                'id' => $this->customer->id,
                'customerCode' => $this->customer->customer_code,
                'customerName' => $this->customer->customer_name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
