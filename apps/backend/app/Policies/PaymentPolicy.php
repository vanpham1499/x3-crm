<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\PaymentRefund;
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

    public function updateRefund(User $user, PaymentRefund $refund): bool
    {
        return $this->manage($user)
            || ($refund->status === PaymentRefund::STATUS_PENDING
                && $user->hasPermission('payment.refund.update'));
    }

    public function delete(User $user, Payment $payment): bool
    {
        return $user->hasPermission('payment.delete');
    }
}
