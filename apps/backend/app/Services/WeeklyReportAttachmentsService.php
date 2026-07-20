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
            $report = $this->reports->findOrFail($weeklyReportId);
            $this->assertDraft($report);
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
            ->where('entity_type', 'media_library')
            ->where('uploaded_by', $user->id)
            ->where('file_url', trim((string) $mediaUrl))
            ->where('file_type', 'like', 'image/%')
            ->first();

        if (! $media) {
            throw ValidationException::withMessages([
                'media_url' => ['Ảnh không tồn tại trong thư viện của bạn.'],
            ]);
        }

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
            $this->assertDraft($attachment->weeklyReport);
            $attachment->delete();

            return ['message' => 'Xóa tệp đính kèm thành công'];
        });
    }

    private function assertDraft(WeeklyReport $report): void
    {
        if ($report->status !== WeeklyReport::STATUS_DRAFT) {
            throw ValidationException::withMessages([
                'status' => ['Chỉ báo cáo nháp mới được thay đổi tệp đính kèm.'],
            ]);
        }
    }
}
