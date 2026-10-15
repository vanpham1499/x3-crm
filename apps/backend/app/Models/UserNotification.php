<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserNotification extends Model
{
    public const KIND_INFO = 'info';

    public const KIND_ACTION = 'action';

    protected $fillable = [
        'user_id',
        'actor_user_id',
        'module',
        'event_key',
        'title',
        'message',
        'kind',
        'severity',
        'entity_type',
        'entity_id',
        'action_url',
        'data',
        'dedupe_key',
        'read_at',
        'resolved_at',
        'archived_at',
        'handled_at',
        'inbox_reopened_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
        'resolved_at' => 'datetime',
        'archived_at' => 'datetime',
        'handled_at' => 'datetime',
        'inbox_reopened_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function scopePendingInbox(Builder $query): Builder
    {
        return $query->whereNull('handled_at')->whereNull('archived_at')
            ->where(fn (Builder $q) => $q->whereNull('resolved_at')->orWhereNotNull('inbox_reopened_at'));
    }

    public function scopeDoneInbox(Builder $query): Builder
    {
        return $query->where(fn (Builder $q) => $q->whereNotNull('handled_at')
            ->orWhereNotNull('archived_at')
            ->orWhere(fn (Builder $resolved) => $resolved->whereNotNull('resolved_at')->whereNull('inbox_reopened_at')));
    }

    public function inboxIsDone(): bool
    {
        return $this->handled_at !== null || $this->archived_at !== null
            || ($this->resolved_at !== null && $this->inbox_reopened_at === null);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
