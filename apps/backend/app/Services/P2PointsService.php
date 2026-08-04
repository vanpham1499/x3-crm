<?php

namespace App\Services;

use App\Http\Resources\P2PointResource;
use App\Models\Option;
use App\Models\P2Point;
use App\Repositories\P2PointRepository;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class P2PointsService extends BaseService
{
    public function __construct(
        private readonly P2PointRepository $points,
        private readonly NotificationDispatchService $notifications,
        private readonly NotificationRecipientResolver $notificationRecipients,
    ) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection(
            $this->points->findAll($this->currentUser(), $this->normalizeFilters($filters)),
            P2PointResource::class,
        );
    }

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        $filters = $this->normalizeFilters($filters);
        $result = $this->apiPaginatedCollection(
            $this->points->findPaginated($this->currentUser(), $filters, $perPage, $page),
            P2PointResource::class,
        );
        $summary = $this->points
            ->summarizeByUser($this->currentUser(), $filters)
            ->map(fn (P2Point $point): array => [
                'userId' => (int) $point->user_id,
                'code' => $point->user?->code,
                'name' => $point->user?->name ?: 'NV #'.$point->user_id,
                'bonusScore' => (float) $point->bonus_score,
                'penaltyScore' => (float) $point->penalty_score,
                'total' => (float) $point->total_score,
                'count' => (int) $point->point_count,
                'pendingCount' => (int) $point->pending_count,
            ])
            ->values();

        $result['meta']['summary'] = $summary->all();
        $result['meta']['overview'] = [
            'bonusScore' => (float) $summary->sum('bonusScore'),
            'penaltyScore' => (float) $summary->sum('penaltyScore'),
            'netScore' => (float) $summary->sum('total'),
            'pendingCount' => (int) $summary->sum('pendingCount'),
        ];

        return $result;
    }

    public function findOne(string $id): array
    {
        $point = $this->points->findVisibleWithRelationsOrFail($this->currentUser(), $id);
        $this->authorize('view', $point);

        return $this->apiResource($point, P2PointResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->preparePayload($data);
            $this->authorize('create', [
                P2Point::class,
                $data['project_id'] ?? null,
                $data['user_id'] ?? null,
            ]);
            $data['created_by'] = $this->currentUser()?->id;

            /** @var P2Point $point */
            $point = $this->points->create($data);
            $point->load(['user', 'project', 'approver', 'categoryOption']);
            $this->syncP2Notifications($point);

            return $this->apiResource($point, P2PointResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $existing = $this->points->findWithRelationsOrFail($id);
            $this->authorize('update', $existing);
            $wasApproved = (bool) $existing->is_approved;
            $data = $this->preparePayload($data);
            $data['updated_by'] = $this->currentUser()?->id;

            /** @var P2Point $point */
            $point = $this->points->update($id, $data);
            $point->load(['user', 'project', 'approver', 'categoryOption']);
            $this->notifications->resolve('p2_point', $point->id, ['p2_approval_required']);

            if ($point->is_approved) {
                $this->notifyP2Recipient(
                    $point,
                    $wasApproved ? 'p2_updated' : 'p2_approved',
                    $wasApproved ? 'Điểm P2 của bạn đã được cập nhật' : 'Điểm P2 của bạn đã được duyệt',
                );
            } else {
                $this->notifyP2Approvers($point);
            }

            return $this->apiResource($point, P2PointResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $point = $this->points->findWithRelationsOrFail($id);
            $this->authorize('delete', $point);
            $this->notifications->resolve('p2_point', $point->id, ['p2_approval_required']);

            if ($point->is_approved) {
                $this->notifyP2Recipient($point, 'p2_deleted', 'Điểm P2 của bạn đã bị xóa');
            }

            $this->points->delete($id);

            return ['message' => 'Xóa điểm P2 thành công'];
        });
    }

    public function approve(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $existing = $this->points->findWithRelationsOrFail($id);
            $this->authorize('approve', $existing);

            /** @var P2Point $point */
            $point = $this->points->update($id, [
                'is_approved' => true,
                'approved_by' => $this->currentUser()?->id,
                'approved_at' => now(),
            ]);
            $point->load(['user', 'project', 'approver', 'categoryOption']);
            $this->notifications->resolve('p2_point', $point->id, ['p2_approval_required']);
            $this->notifyP2Recipient($point, 'p2_approved', 'Điểm P2 của bạn đã được duyệt');

            return $this->apiResource($point, P2PointResource::class);
        });
    }

    private function syncP2Notifications(P2Point $point): void
    {
        if ($point->is_approved) {
            $this->notifyP2Recipient($point, 'p2_approved', 'Điểm P2 của bạn đã được duyệt');

            return;
        }

        $this->notifyP2Approvers($point);
    }

    private function notifyP2Approvers(P2Point $point): void
    {
        $this->notifications->send($this->notificationRecipients->p2PointApprovers($point), [
            'module' => 'p2point',
            'event_key' => 'p2_approval_required',
            'title' => 'Có điểm P2 đang chờ duyệt',
            'message' => $this->p2Message($point),
            'kind' => 'action',
            'severity' => 'warning',
            'entity_type' => 'p2_point',
            'entity_id' => $point->id,
            'action_url' => '/p2-points',
            'dedupe_key' => 'p2_approval_required:'.$point->id,
            'reopen_resolved' => true,
        ]);
    }

    private function notifyP2Recipient(P2Point $point, string $eventKey, string $title): void
    {
        $recipients = $this->notificationRecipients->authorizedUsers([
            $point->user_id,
            $point->created_by,
        ], 'view', $point);

        $this->notifications->send($recipients, [
            'module' => 'p2point',
            'event_key' => $eventKey,
            'title' => $title,
            'message' => $this->p2Message($point),
            'severity' => $eventKey === 'p2_deleted' ? 'error' : 'success',
            'entity_type' => 'p2_point',
            'entity_id' => $point->id,
            'action_url' => '/p2-points',
            'dedupe_key' => $eventKey.':'.$point->id.($eventKey === 'p2_updated'
                ? ':'.$point->updated_at?->format('YmdHisu')
                : ''),
        ]);
    }

    private function p2Message(P2Point $point): string
    {
        $score = rtrim(rtrim(number_format(abs((float) $point->score), 2, '.', ''), '0'), '.');
        $sign = $point->type === P2Point::TYPE_PENALTY ? '-' : '+';
        $category = $point->categoryOption?->label ?: $point->category;

        return implode(' · ', array_filter([
            $point->user?->name,
            $category,
            $sign.$score.' điểm',
            $point->project?->project_name,
        ]));
    }

    private function preparePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        if (array_key_exists('category', $data)) {
            $option = Option::query()
                ->where('group', Option::GROUP_P2_CATEGORY)
                ->where('key', $data['category'])
                ->first();

            if (! $option || empty($option->meta['type'])) {
                throw new UnprocessableEntityHttpException('Hạng mục P2 không hợp lệ');
            }

            $data['type'] = $option->meta['type'];
        }

        return $data;
    }

    private function normalizeFilters(array $filters): array
    {
        return $this->normalizeKeys($filters);
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'userId' => 'user_id',
            'projectId' => 'project_id',
            'entryDate' => 'entry_date',
            'customerRef' => 'customer_ref',
            'isApproved' => 'is_approved',
            'dateFrom' => 'date_from',
            'dateTo' => 'date_to',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }
}
