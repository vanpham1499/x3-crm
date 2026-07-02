<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends BaseModel
{
    protected $fillable = [
        'revenue_id',
        'customer_id',
        'invoice_type',
        'invoice_no',
        'issued_date',
        'company_name',
        'tax_code',
        'address',
        'receiver_email',
        'amount_before_vat',
        'vat_amount',
        'amount_after_vat',
        'status_id',
        'file_url',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'issued_date' => 'date',
        'amount_before_vat' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'amount_after_vat' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function revenue(): BelongsTo
    {
        return $this->belongsTo(Revenue::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(Status::class);
    }
}
