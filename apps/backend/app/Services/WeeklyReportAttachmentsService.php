<?php

namespace App\Services;

use App\Http\Resources\WeeklyReportAttachmentResource;
use App\Models\User;
use App\Models\WeeklyReportAttachment;
use App\Repositories\WeeklyReportRepository;
use App\Support\FileUploadStorage;
use Illuminate\Http\UploadedFile;

class WeeklyReportAttachmentsService extends BaseService
{
    public function __construct(private readonly WeeklyReportRepository $reports) {}

    public function upload(string $weeklyReportId, UploadedFile $file, User $user): array
    {
        return $this->transaction(function () use ($weeklyReportId, $file, $user): array {
            $report = $this->reports->findOrFail($weeklyReportId);
            $stored = FileUploadStorage::store($file, 'weekly-reports');

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

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            WeeklyReportAttachment::query()->findOrFail($id)->delete();

            return ['message' => 'Xóa tệp đính kèm thành công'];
        });
    }
}
