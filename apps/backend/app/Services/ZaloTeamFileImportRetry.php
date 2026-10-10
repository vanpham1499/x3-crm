<?php

namespace App\Services;

class ZaloTeamFileImportRetry
{
    public function run(callable $operation, callable $pulse, callable $status, int $attempts = 12): mixed
    {
        for ($attempt = 1; ; $attempt++) {
            $pulse();
            try {
                $result = $operation();
                $status(null);

                return $result;
            } catch (ZaloTeamImportTransportException $e) {
                if (! $e->retryable || $attempt >= $attempts) {
                    throw $e;
                }
                $seconds = min(30, 2 ** min(5, $attempt - 1));
                $status(['attempt' => $attempt, 'seconds' => $seconds, 'nextAt' => (int) ((microtime(true) + $seconds) * 1000),
                    'reason' => $e->getMessage(), 'httpStatus' => $e->httpStatus, 'stage' => $e->stage]);
                $this->wait($seconds, $pulse);
            }
        }
    }

    protected function wait(int $seconds, callable $pulse): void
    {
        $until = microtime(true) + $seconds;
        do {
            $pulse();
            usleep(250000);
        } while (microtime(true) < $until);
    }
}
