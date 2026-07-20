<?php

namespace App\Http\Controllers;

use App\Http\Requests\Media\UpdateMediaRequest;
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
        $scope = (string) $request->query('scope', 'mine');
        $keyword = $request->query('keyword');

        if ($request->query->has('page') || $request->query->has('per_page')) {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(100, max(1, (int) $request->query('per_page', 12)));
            $result = $this->media->findPaginated($user, $scope, $keyword, $perPage, $page);

            return $this->success($result['data'], 200, $result['meta']);
        }

        return $this->success($this->media->findAll(
            $user,
            $scope,
            $keyword,
        ));
    }

    public function upload(UploadMediaRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $this->success($this->media->upload(
            $request->file('file'),
            $user,
            $request->validatedData('name'),
        ), 201);
    }

    public function update(UpdateMediaRequest $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $this->success($this->media->update($id, $request->validatedData(), $user));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $this->success($this->media->remove(
            $id,
            $user,
            $request->boolean('detach_usage'),
        ));
    }
}
