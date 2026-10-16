<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserNotificationsChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly int $userId,
        public readonly string $reason,
        public readonly ?int $notificationId = null,
        public readonly ?string $entityType = null,
        public readonly int|string|null $entityId = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('users.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'notifications.changed';
    }

    public function broadcastWith(): array
    {
        return [
            'reason' => $this->reason,
            'notificationId' => $this->notificationId,
            'entityType' => $this->entityType,
            'entityId' => $this->entityId,
        ];
    }

    public function broadcastQueue(): string
    {
        return 'realtime';
    }
}
