<?php

namespace App\Http\Controllers;

use App\Http\Requests\WeeklyReports\UploadWeeklyReportAttachmentRequest;
use App\Models\User;
use App\Services\WeeklyReportAttachmentsService;
use Illuminate\Http\JsonResponse;

class WeeklyReportAttachmentsController extends Controller
{
    public function __construct(private readonly WeeklyReportAttachmentsService $attachments) {}

    public function store(UploadWeeklyReportAttachmentRequest $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $this->success($this->attachments->upload(
            $id,
            $request->file('file'),
            $user,
            $request->validatedData('media_url'),
        ), 201);
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->attachments->remove($id));
    }
}
