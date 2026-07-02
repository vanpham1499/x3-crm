<?php

namespace App\Services;

use App\Http\Resources\AttachmentResource;
use App\Models\Attachment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class MediaService extends BaseService
{
    private function getFrontendPublicPath(): string
    {
        return rtrim(
            env('MEDIA_PUBLIC_PATH', base_path('../frontend/public')),
            DIRECTORY_SEPARATOR . '/'
        );
    }

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
            $now = now();
            $directory = sprintf('uploads/%s/%s', $now->format('Y'), $now->format('m'));
            $absoluteDirectory = $this->getFrontendPublicPath()
                . DIRECTORY_SEPARATOR
                . str_replace('/', DIRECTORY_SEPARATOR, $directory);

            if (! is_dir($absoluteDirectory)) {
                mkdir($absoluteDirectory, 0775, true);
            }

            $originalName = $file->getClientOriginalName();
            $mimeType = $file->getMimeType();
            $fileSize = $file->getSize() ?: 0;
            $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'jpg');
            $baseName = Str::slug(pathinfo($originalName, PATHINFO_FILENAME)) ?: 'image';
            $fileName = sprintf('%s-%s.%s', $baseName, Str::lower(Str::random(10)), $extension);

            $file->move($absoluteDirectory, $fileName);

            $payload = [
                'entity_type' => 'media_library',
                'entity_id' => $user->id,
                'file_name' => $fileName,
                'file_url' => '/' . $directory . '/' . $fileName,
                'file_type' => $mimeType,
                'uploaded_by' => $user->id,
                'created_by' => $user->id,
            ];

            if (Schema::hasColumn('attachments', 'original_name')) {
                $payload['original_name'] = $originalName;
            }

            if (Schema::hasColumn('attachments', 'mime_type')) {
                $payload['mime_type'] = $mimeType;
            }

            if (Schema::hasColumn('attachments', 'file_size')) {
                $payload['file_size'] = $fileSize;
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
