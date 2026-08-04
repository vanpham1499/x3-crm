<?php

namespace App\Http\Controllers;

use App\Services\UserNotificationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserNotificationsController extends Controller
{
    public function __construct(private readonly UserNotificationsService $notifications) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'filter' => ['nullable', Rule::in(['all', 'unread', 'action', 'archived'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);
        $result = $this->notifications->findPaginated(
            $request->user(),
            $validated['filter'] ?? 'all',
            (int) ($validated['per_page'] ?? 20),
            (int) ($validated['page'] ?? 1),
        );

        return $this->success($result['data'], 200, $result['meta']);
    }

    public function summary(Request $request): JsonResponse
    {
        return $this->success($this->notifications->summary($request->user()));
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        return $this->success($this->notifications->markRead($request->user(), $id));
    }

    public function markAllRead(Request $request): JsonResponse
    {
        return $this->message('Đã đánh dấu toàn bộ thông báo là đã đọc.', 200, [
            'updatedCount' => $this->notifications->markAllRead($request->user()),
        ]);
    }

    public function archive(Request $request, string $id): JsonResponse
    {
        return $this->success($this->notifications->archive($request->user(), $id));
    }

    public function restore(Request $request, string $id): JsonResponse
    {
        return $this->success($this->notifications->restore($request->user(), $id));
    }
}
