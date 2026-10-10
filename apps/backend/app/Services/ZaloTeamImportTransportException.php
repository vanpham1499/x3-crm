<?php

namespace App\Services;

class ZaloTeamImportTransportException extends \RuntimeException
{
    public function __construct(string $reason, public readonly bool $retryable, public readonly int $httpStatus, public readonly string $stage)
    {
        parent::__construct($reason);
    }
}
