<?php

namespace App\Policies;

use App\Models\User;

class PaymentPolicy
{
    /** Full accounting controls beyond the separately delegated actions below. */
    public function manage(User $user): bool
    {
        return $user->hasPermission('payment.manage');
    }

    public function allocate(User $user): bool
    {
        return $this->manage($user) || $user->hasPermission('payment.allocate');
    }

    public function createRefund(User $user): bool
    {
        return $this->manage($user) || $user->hasPermission('payment.refund.create');
    }
}
