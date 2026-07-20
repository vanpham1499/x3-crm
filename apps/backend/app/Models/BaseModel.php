<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

abstract class BaseModel extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected static function booted(): void
    {
        static::creating(function (BaseModel $model): void {
            $userId = request()->user()?->getAuthIdentifier();

            if (! $userId) {
                return;
            }

            if ($model->isFillable('created_by') && ! $model->getAttribute('created_by')) {
                $model->setAttribute('created_by', $userId);
            }

            if ($model->isFillable('updated_by') && ! $model->getAttribute('updated_by')) {
                $model->setAttribute('updated_by', $userId);
            }
        });

        static::updating(function (BaseModel $model): void {
            $userId = request()->user()?->getAuthIdentifier();

            if ($userId && $model->isFillable('updated_by')) {
                $model->setAttribute('updated_by', $userId);
            }
        });
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function deletedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }
}
