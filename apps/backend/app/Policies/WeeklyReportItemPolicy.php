<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WeeklyReportItem;

class WeeklyReportItemPolicy
{
    public function update(User $user, WeeklyReportItem $message): bool
    {
        return (int) $message->created_by === (int) $user->id;
    }

    public function delete(User $user, WeeklyReportItem $message): bool
    {
        return $this->update($user, $message);
    }
}
