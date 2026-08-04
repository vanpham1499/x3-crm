<?php

namespace App\Models;

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
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
        'resolved_at' => 'datetime',
        'archived_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
