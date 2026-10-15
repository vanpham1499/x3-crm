<?php

// Regression scenarios for the 09/10 board complaint. No database or customer data is modified.
require __DIR__.'/../../apps/backend/vendor/autoload.php';

use App\Support\WeeklyReportBoardOrder as Board;

$checks = 0;
function checkBoard(mixed $actual, mixed $expected, string $message): void
{
    global $checks;
    if ($actual !== $expected) {
        throw new RuntimeException($message.': '.json_encode([$actual, $expected]));
    }
    $checks++;
}
function row(int $id, string $date, string $status, ?string $submittedAt = null): array
{
    return ['settingId' => $id, 'dueDate' => $date, 'progressStatus' => $status,
        'project' => ['projectCode' => sprintf('%03d', $id)], 'report' => ['submittedAt' => $submittedAt]];
}
function ids(array $rows): array { return array_column($rows, 'settingId'); }

$today = '2026-10-09';
$rows = [row(1, '2026-10-05', 'approved'), row(2, '2026-10-08', 'submitted'),
    row(3, $today, 'draft'), row(4, $today, 'submitted'), row(5, '2026-10-07', 'not_created'),
    row(6, '2026-10-10', 'draft'), row(7, $today, 'approved'), row(8, '2026-10-06', 'rejected')];
checkBoard(ids(Board::arrange($rows, $today)), [3, 4, 8, 5, 2, 6, 1, 7], 'Today before backlog, approved last');
$rows[2]['progressStatus'] = 'submitted';
checkBoard(ids(Board::arrange($rows, $today)), [3, 4, 8, 5, 2, 6, 1, 7], 'Submitting does not push today behind backlog');
checkBoard(ids(Board::arrange($rows, $today, 'today')), [3, 4, 7], 'Today includes submitted and approved');
checkBoard(ids(Board::arrange($rows, $today, 'past')), [8, 5, 2, 1], 'Past dates within result');
checkBoard(ids(Board::arrange($rows, $today, 'upcoming')), [6], 'Upcoming dates');
checkBoard(Board::scopeCounts($rows, $today), ['all' => 8, 'today' => 3, 'past' => 4, 'upcoming' => 1], 'Counts across all results');
$pending = array_values(array_filter($rows, fn ($r) => $r['progressStatus'] === 'submitted'));
checkBoard(Board::scopeCounts($pending, $today), ['all' => 3, 'today' => 2, 'past' => 1, 'upcoming' => 0], 'Counts respect progress filter');
$queue = [row(10, '2026-10-08', 'submitted', '2026-10-09T02:00:00Z'),
    row(11, $today, 'submitted', '2026-10-08T03:00:00Z'), row(12, $today, 'submitted', '2026-10-09T03:00:00Z')];
checkBoard(ids(Board::arrange($queue, $today, 'all', true)), [11, 10, 12], 'Approval uses submission age, not deadline');
checkBoard(ids(Board::arrange($queue, $today, 'today', true)), [11, 12], 'Today and waiting approval combine');
$many = array_map(fn ($id) => row($id, '2026-10-08', 'submitted'), range(20, 39));
$many[] = row(40, $today, 'submitted');
$sorted = Board::arrange($many, $today);
checkBoard(ids(array_slice($sorted, 0, 10)), [40, 20, 21, 22, 23, 24, 25, 26, 27, 28], 'Today stays on page one with twenty old reports');
checkBoard(count(array_unique(ids($sorted))), 21, 'No lost or duplicated rows across pages');
$duplicates = [row(2, $today, 'submitted'), row(1, $today, 'submitted')];
$duplicates[0]['project']['projectCode'] = $duplicates[1]['project']['projectCode'] = 'same';
checkBoard(ids(Board::arrange($duplicates, $today)), [1, 2], 'Stable tie breaker');
checkBoard(Board::arrange([], $today), [], 'Empty results');
checkBoard(ids(Board::arrange($rows, '2026-10-13', 'today')), [], 'Historical week does not pretend a day is today');
echo "$checks board checks passed\n";
