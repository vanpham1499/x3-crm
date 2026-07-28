<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetingHistory extends Model
{
    protected $fillable = [
        'meeting_id',
        'action',
        'payload',
        'actor_user_id',
    ];

    protected $casts = [
        'payload' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
