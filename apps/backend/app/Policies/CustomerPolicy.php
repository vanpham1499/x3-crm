<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\User;

class CustomerPolicy
{
    public function create(User $user): bool
    {
        return $user->hasPermission('customer.create');
    }

    public function update(User $user, Customer $customer): bool
    {
        if ($user->hasPermission('customer.update_all')) {
            return true;
        }

        return $user->hasPermission('customer.update') && $customer->isAssignedTo($user);
    }

    public function delete(User $user, Customer $customer): bool
    {
        if ($user->hasPermission('customer.delete_all')) {
            return true;
        }

        return $user->hasPermission('customer.delete') && $customer->isAssignedTo($user);
    }
}
