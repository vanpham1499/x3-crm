<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attachment extends BaseModel
{
    protected $fillable = [
        'entity_type',
        'entity_id',
        'file_name',
        'original_name',
        'file_url',
        'file_type',
        'mime_type',
        'file_size',
        'disk',
        'uploaded_by',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
