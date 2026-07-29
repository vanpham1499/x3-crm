<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\User;

class CustomerPolicy
{
    public function view(User $user, Customer $customer): bool
    {
        return $this->allows($user, $customer, 'view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('customer.create');
    }

    public function update(User $user, Customer $customer): bool
    {
        return $this->allows($user, $customer, 'update');
    }

    public function delete(User $user, Customer $customer): bool
    {
        return $this->allows($user, $customer, 'delete');
    }

    private function allows(User $user, Customer $customer, string $action): bool
    {
        if ($user->hasPermission("customer.{$action}_all")) {
            return true;
        }

        if ($user->hasPermission("customer.{$action}_department") && $customer->isInDepartmentOf($user)) {
            return true;
        }

        return $user->hasPermission("customer.{$action}") && $customer->isAssignedTo($user);
    }
}
