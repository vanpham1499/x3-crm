<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WeeklyReportAttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'weeklyReportId' => $this->weekly_report_id,
            'fileName' => $this->file_name,
            'fileUrl' => $this->file_url,
            'mimeType' => $this->mime_type,
            'uploadedBy' => $this->whenLoaded('uploadedBy', fn () => $this->uploadedBy ? [
                'id' => $this->uploadedBy->id,
                'name' => $this->uploadedBy->name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
