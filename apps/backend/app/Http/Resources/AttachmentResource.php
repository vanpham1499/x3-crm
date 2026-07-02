<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $url = $this->file_url;

        return [
            'id' => $this->id,
            'url' => $url,
            'previewUrl' => $url ? url($url) : null,
            'fileName' => $this->file_name,
            'originalName' => $this->original_name ?: $this->file_name,
            'fileType' => $this->file_type,
            'mimeType' => $this->mime_type ?: $this->file_type,
            'size' => (int) $this->file_size,
            'uploadedBy' => $this->uploaded_by,
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
