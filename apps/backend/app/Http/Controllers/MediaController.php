<?php

namespace App\Http\Controllers;

use App\Http\Requests\Media\UploadMediaRequest;
use App\Models\User;
use App\Services\MediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MediaController extends Controller
{
    public function __construct(private readonly MediaService $media) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $this->success($this->media->findAll(
            $user,
            (string) $request->query('scope', 'mine'),
            $request->query('keyword'),
        ));
    }

    public function upload(UploadMediaRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $this->success($this->media->upload($request->file('file'), $user), 201);
    }
}
