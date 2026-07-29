<?php

namespace App\Policies;

use App\Models\Attachment;
use App\Models\User;

class AttachmentPolicy
{
    public function view(User $user, Attachment $attachment): bool
    {
        return $attachment->entity_type === 'media_library'
            && $this->allows($user, $attachment, 'view');
    }

    public function update(User $user, Attachment $attachment): bool
    {
        return $attachment->entity_type === 'media_library'
            && $this->allows($user, $attachment, 'update');
    }

    public function delete(User $user, Attachment $attachment): bool
    {
        return $attachment->entity_type === 'media_library'
            && $this->allows($user, $attachment, 'delete');
    }

    private function allows(User $user, Attachment $attachment, string $action): bool
    {
        if ($user->hasPermission("media.{$action}_all")) {
            return true;
        }

        if (
            $user->hasPermission("media.{$action}_department")
            && $user->sharesDepartmentWith($attachment->uploadedBy)
        ) {
            return true;
        }

        return $user->hasPermission("media.{$action}")
            && (int) $attachment->uploaded_by === (int) $user->id;
    }
}
