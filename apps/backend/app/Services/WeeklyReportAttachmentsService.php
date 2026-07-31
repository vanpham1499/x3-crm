<?php

namespace App\Services;

use App\Http\Resources\WeeklyReportAttachmentResource;
use App\Models\Attachment;
use App\Models\User;
use App\Models\WeeklyReport;
use App\Models\WeeklyReportAttachment;
use App\Repositories\WeeklyReportRepository;
use App\Support\FileUploadStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

class WeeklyReportAttachmentsService extends BaseService
{
    public function __construct(private readonly WeeklyReportRepository $reports) {}

    public function upload(
        string $weeklyReportId,
        ?UploadedFile $file,
        User $user,
        ?string $mediaUrl = null,
    ): array {
        return $this->transaction(function () use ($weeklyReportId, $file, $user, $mediaUrl): array {
            $report = $this->reports->findWithRelationsOrFail($weeklyReportId);
            $this->authorize('update', $report);
            $this->assertEditable($report);
            $stored = $file
                ? FileUploadStorage::store($file, 'weekly-reports')
                : $this->resolveMediaLibraryImage($mediaUrl, $user);

            /** @var WeeklyReportAttachment $attachment */
            $attachment = $report->attachments()->create([
                'file_name' => $stored['fileName'],
                'file_url' => $stored['fileUrl'],
                'mime_type' => $stored['mimeType'],
                'uploaded_by' => $user->id,
                'created_by' => $user->id,
            ]);

            return $this->apiResource($attachment->load('uploadedBy'), WeeklyReportAttachmentResource::class);
        });
    }

    private function resolveMediaLibraryImage(?string $mediaUrl, User $user): array
    {
        /** @var Attachment|null $media */
        $media = Attachment::query()
            ->with('uploadedBy:id,name,department_id')
            ->where('entity_type', 'media_library')
            ->where('file_url', trim((string) $mediaUrl))
            ->where('file_type', 'like', 'image/%')
            ->first();

        if (! $media) {
            throw ValidationException::withMessages([
                'media_url' => ['Ảnh không tồn tại trong thư viện của bạn.'],
            ]);
        }

        $this->authorize('view', $media);

        return [
            'fileName' => $media->original_name ?: $media->file_name,
            'fileUrl' => $media->file_url,
            'mimeType' => $media->mime_type ?: $media->file_type,
        ];
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var WeeklyReportAttachment $attachment */
            $attachment = WeeklyReportAttachment::query()->with('weeklyReport')->findOrFail($id);
            $this->authorize('update', $attachment->weeklyReport);
            $this->assertEditable($attachment->weeklyReport);
            $attachment->delete();

            return ['message' => 'Xóa tệp đính kèm thành công'];
        });
    }

    private function assertEditable(WeeklyReport $report): void
    {
        if (! in_array($report->status, [WeeklyReport::STATUS_DRAFT, WeeklyReport::STATUS_REJECTED], true)) {
            throw ValidationException::withMessages([
                'status' => ['Chỉ báo cáo nháp hoặc đã bị từ chối mới được thay đổi tệp đính kèm.'],
            ]);
        }
    }
}
