<?php

namespace App\Support;

final class WeeklyReportBoardOrder
{
    public static function dateScope(array $row, string $today): string
    {
        return $row['dueDate'] === $today ? 'today' : ($row['dueDate'] < $today ? 'past' : 'upcoming');
    }

    /** Count the entire filtered result, before applying the date scope or pagination. */
    public static function scopeCounts(array $rows, string $today): array
    {
        $counts = ['all' => count($rows), 'today' => 0, 'past' => 0, 'upcoming' => 0];
        foreach ($rows as $row) {
            $counts[self::dateScope($row, $today)]++;
        }

        return $counts;
    }

    public static function arrange(array $rows, string $today, string $scope = 'all', bool $approvalQueue = false): array
    {
        $rows = array_values(array_filter($rows, fn (array $row) => $scope === 'all' || self::dateScope($row, $today) === $scope));
        usort($rows, function (array $left, array $right) use ($today, $approvalQueue): int {
            // The approval queue processes the oldest submission first. Other views keep today's work visible after submission.
            $priority = $approvalQueue
                ? strcmp($left['report']['submittedAt'] ?? $left['dueDate'], $right['report']['submittedAt'] ?? $right['dueDate'])
                : self::priority($left, $today) <=> self::priority($right, $today);

            return $priority
                ?: strcmp($left['dueDate'], $right['dueDate'])
                ?: strcmp($left['project']['projectCode'] ?? '', $right['project']['projectCode'] ?? '')
                ?: ($left['settingId'] <=> $right['settingId']);
        });

        return $rows;
    }

    private static function priority(array $row, string $today): int
    {
        if ($row['progressStatus'] === 'approved') {
            return 3;
        }

        return match (self::dateScope($row, $today)) {
            'today' => 0,
            'past' => 1,
            default => 2,
        };
    }
}
