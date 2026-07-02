<?php

namespace App\Models;

class Status extends BaseModel
{
    public const TYPE_LEAD = 'lead';
    public const TYPE_PROJECT = 'project';
    public const TYPE_CONTRACT = 'contract';
    public const TYPE_PAYMENT = 'payment';
    public const TYPE_INVOICE = 'invoice';

    protected $fillable = [
        'type',
        'name',
        'sort_order',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
