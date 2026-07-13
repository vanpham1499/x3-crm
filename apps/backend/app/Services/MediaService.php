<?php

namespace App\Services;

use App\Http\Resources\AttachmentResource;
use App\Models\Attachment;
use App\Models\User;
use App\Support\FileUploadStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;

class MediaService extends BaseService
{
    public function findAll(User $user, string $scope = 'mine', ?string $keyword = null)
    {
        $query = Attachment::query()
            ->where('entity_type', 'media_library')
            ->where('file_type', 'like', 'image/%')
            ->when($scope !== 'all' || $user->role !== User::ROLE_ADMIN, fn ($query) => $query->where('uploaded_by', $user->id))
            ->when($keyword, function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query->where('file_name', 'ilike', "%{$keyword}%");

                    if (Schema::hasColumn('attachments', 'original_name')) {
                        $query->orWhere('original_name', 'ilike', "%{$keyword}%");
                    }
                });
            })
            ->latest()
            ->limit(80)
            ->get();

        return $this->apiCollection($query, AttachmentResource::class);
    }

    public function upload(UploadedFile $file, User $user): array
    {
        return $this->transaction(function () use ($file, $user): array {
            $stored = FileUploadStorage::store($file, 'media');

            $payload = [
                'entity_type' => 'media_library',
                'entity_id' => $user->id,
                'file_name' => $stored['fileName'],
                'file_url' => $stored['fileUrl'],
                'file_type' => $stored['mimeType'],
                'uploaded_by' => $user->id,
                'created_by' => $user->id,
            ];

            if (Schema::hasColumn('attachments', 'original_name')) {
                $payload['original_name'] = $stored['originalName'];
            }

            if (Schema::hasColumn('attachments', 'mime_type')) {
                $payload['mime_type'] = $stored['mimeType'];
            }

            if (Schema::hasColumn('attachments', 'file_size')) {
                $payload['file_size'] = $stored['fileSize'];
            }

            if (Schema::hasColumn('attachments', 'disk')) {
                $payload['disk'] = 'public';
            }

            /** @var Attachment $attachment */
            $attachment = Attachment::query()->create($payload);

            return $this->apiResource($attachment, AttachmentResource::class);
        });
    }
}
