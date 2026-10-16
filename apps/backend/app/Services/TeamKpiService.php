<?php

namespace App\Services;

use App\Models\KpiTarget;
use App\Models\Team;
use App\Models\TeamMembership;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;

/** Membership is resolved at receipt time. Refunds reverse the original receipt lots (FIFO). */
class TeamKpiService
{
    public function credits(CarbonImmutable $start, CarbonImmutable $end): Collection
    {
        $key = 'team.kpi.credits.'.$end->toIso8601String();
        if (request()->attributes->has($key)) {
            return request()->attributes->get($key)->filter(fn ($e) => $e['at']->greaterThanOrEqualTo($start) && $e['at']->lessThan($end))->values();
        }
        $events = app(KpiService::class)->feeEvents('1970-01-01', $end->toDateTimeString());
        $userIds = $events->flatMap(fn ($e) => [$e['basis']['managerId'], $e['basis']['salesId']])->filter()->unique();
        $history = TeamMembership::whereIn('user_id', $userIds)->orderBy('started_at')->get()->groupBy('user_id');
        $credits = self::allocate($events, $history);
        request()->attributes->set($key, $credits);

        return $credits->filter(fn ($e) => $e['at']->greaterThanOrEqualTo($start) && $e['at']->lessThan($end))->values();
    }

    public static function allocate(Collection $events, Collection $history): Collection
    {
        $lots = [];
        $credits = collect();
        foreach ($events->sortBy(fn ($e) => $e['at']->format('Y-m-d H:i:s.u').'-'.($e['refund'] ? '1' : '0').'-'.str_pad((string) preg_replace('/^.*-/', '', $e['id']), 20, '0', STR_PAD_LEFT)) as $event) {
            $basis = $event['basis'];
            foreach (['implementation' => $basis['managerId'], 'acquisition' => $basis['firstQuotation'] ? $basis['salesId'] : null] as $branch => $userId) {
                if (! $userId) {
                    continue;
                }
                $key = $event['quotation']->id.':'.$branch;
                if ($event['amount'] >= 0) {
                    $membership = $history->get($userId, collect())->last(fn ($m) => $m->started_at->lessThanOrEqualTo($event['at']) && (! $m->ended_at || $m->ended_at->greaterThan($event['at'])));
                    $teamId = $membership?->team_id;
                    $lots[$key][] = ['teamId' => $teamId, 'remaining' => $event['amount']];
                    $credits->push($event + ['teamId' => $teamId, 'userId' => (int) $userId, 'branch' => $branch, 'creditAmount' => $event['amount']]);
                } else {
                    $remaining = -$event['amount'];
                    foreach ($lots[$key] ?? [] as $i => $lot) {
                        $take = min($remaining, $lot['remaining']);
                        if ($take <= 0) {
                            continue;
                        }
                        $lots[$key][$i]['remaining'] -= $take;
                        $remaining -= $take;
                        $credits->push($event + ['teamId' => $lot['teamId'], 'userId' => (int) $userId, 'branch' => $branch, 'creditAmount' => -$take]);
                        if ($remaining < 0.005) {
                            break;
                        }
                    }
                    if ($remaining > 0.005) {
                        $credits->push($event + ['teamId' => null, 'userId' => (int) $userId, 'branch' => $branch, 'creditAmount' => -$remaining]);
                    }
                }
            }
        }

        return $credits;
    }

    public function periods(CarbonImmutable $start, CarbonImmutable $lastMonth, array $teamIds): Collection
    {
        $credits = $this->credits($start, $lastMonth->addMonth())->filter(fn ($c) => in_array((int) $c['teamId'], $teamIds, true));
        $teams = Team::withTrashed()->whereIn('id', $teamIds)->get();
        $userIds = User::whereIn('team_id', $teamIds)->pluck('id')->merge($credits->pluck('userId'))->unique();
        $users = User::withTrashed()->with('department')->whereIn('id', $userIds)->get();
        $targets = KpiTarget::where('scope_type', 'team')->whereIn('scope_id', $teamIds)->whereBetween('period_month', [$start->toDateString(), $lastMonth->toDateString()])->get();
        $periods = collect();
        for ($at = $start; $at->lessThanOrEqualTo($lastMonth); $at = $at->addMonth()) {
            $month = $at->format('Y-m');
            $events = $credits->filter(fn ($c) => $c['at']->format('Y-m') === $month);
            $teamRows = $teams->map(function ($team) use ($events, $targets, $month) {
                $target = (float) ($targets->first(fn ($t) => (int) $t->scope_id === (int) $team->id && $t->period_month->format('Y-m') === $month)?->target_amount ?? 0);
                $viewer = request()->user();
                $canManage = ! $team->trashed() && $viewer && ($viewer->hasPermission('kpi.manage_all')
                    || ($viewer->hasPermission('kpi.manage_department') && $viewer->canAccessDepartment($team->department_id))
                    || ($viewer->hasPermission('kpi.manage_team') && in_array((int) $team->id, $viewer->accessibleTeamIds(), true)));

                return ['id' => $team->id, 'scopeType' => 'team', 'name' => $team->name, 'canManageTarget' => (bool) $canManage] + self::amounts($events->where('teamId', $team->id), $target);
            });
            $employeeRows = $users->map(fn ($user) => ['id' => $user->id, 'scopeType' => 'employee', 'code' => $user->code, 'name' => $user->name,
                'departmentId' => $user->department_id, 'departmentName' => $user->department?->name, 'isActive' => $user->is_active && ! $user->trashed(), 'teamId' => $user->team_id]
                + self::amounts($events->where('userId', $user->id), 0));
            $periods->push(['period' => $month, 'metric' => 'management_fee', 'services' => [], 'departments' => $teamRows, 'employees' => $employeeRows,
                'summary' => ['services' => self::summary(collect()), 'departments' => self::summary($teamRows), 'employees' => self::summary($employeeRows)]]);
        }

        return $periods;
    }

    private static function summary(Collection $rows): array
    {
        $target = (float) $rows->sum('targetAmount');
        $actual = (float) $rows->sum('actualAmount');

        return ['targetAmount' => $target, 'actualAmount' => $actual, 'completionRate' => $target > 0 ? round($actual / $target * 100, 2) : null];
    }

    public function detail(string $period, string $scopeType, int $scopeId, array $teamIds): array
    {
        $start = CarbonImmutable::parse($period.'-01')->startOfMonth();
        $credits = $this->credits($start, $start->addMonth())->filter(fn ($c) => in_array((int) $c['teamId'], $teamIds, true)
            && ($scopeType !== 'employee' || $c['userId'] === $scopeId));
        if ($scopeType === 'employee' && $credits->isEmpty() && ! User::whereKey($scopeId)->whereIn('team_id', $teamIds)->exists()) {
            throw new AuthorizationException('Nhân sự không thuộc phạm vi nhóm.');
        }
        $entries = $credits->values()->map(function ($c, $i) {
            $quote = $c['quotation'];
            $project = $quote->project;

            return ['id' => $c['id'].'-'.$c['branch'].'-'.$i, 'branch' => $c['branch'],
                'kind' => $c['branch'] === 'acquisition' ? ($c['creditAmount'] < 0 ? 'acquisition_refund' : 'acquisition_credit') : ($c['creditAmount'] < 0 ? 'refund' : 'received'),
                'label' => $c['creditAmount'] < 0 ? 'Hoàn phí về nhóm đã hưởng' : 'Phí quản lý ghi nhận',
                'eventAt' => \App\Support\KpiReportingTime::fromLedger($c['at'])->toIso8601String(),
                'sourceAmount' => round(abs($c['sourceAmount']) * abs($c['creditAmount']) / max(0.005, abs($c['amount'])), 2),
                'beforeVatAmount' => abs($c['creditAmount']),
                'profitImpactAmount' => $c['creditAmount'], 'reference' => $c['reference'],
                'project' => ['id' => $c['projectId'], 'code' => $project?->project_code, 'name' => $project?->project_name, 'type' => $project?->project_type],
                'quotation' => ['id' => $quote->id, 'code' => $quote->quotation_code]];
        });
        $totals = fn ($rows) => ['receivedAmount' => round($rows->whereIn('kind', ['received', 'acquisition_credit'])->sum('sourceAmount'), 2), 'costAmount' => 0.0,
            'refundAmount' => round($rows->whereIn('kind', ['refund', 'acquisition_refund'])->sum('sourceAmount'), 2), 'profitAmount' => round($rows->sum('profitImpactAmount'), 2)];

        return ['period' => $period, 'metric' => 'management_fee', 'scope' => ['type' => $scopeType, 'id' => $scopeId,
            'name' => $scopeType === 'team' ? Team::withTrashed()->findOrFail($scopeId)->name : User::withTrashed()->findOrFail($scopeId)->name],
            'totals' => $totals($entries->where('branch', 'implementation')), 'branches' => collect(['implementation' => 'KPI triển khai', 'acquisition' => 'KPI Sale · theo dõi riêng'])->map(fn ($label, $key) => [
                'key' => $key, 'label' => $label, 'totals' => $totals($entries->where('branch', $key)), 'entries' => $entries->where('branch', $key)->values()->all(),
            ])->values()->all()];
    }

    private static function amounts(Collection $credits, float $target): array
    {
        $implementation = $credits->where('branch', 'implementation');
        $acquisition = $credits->where('branch', 'acquisition');
        $received = fn ($items) => round($items->sum(fn ($e) => max(0, $e['creditAmount'])), 2);
        $refunded = fn ($items) => round($items->sum(fn ($e) => max(0, -$e['creditAmount'])), 2);
        $total = round($implementation->sum('creditAmount'), 2);

        return ['targetAmount' => $target, 'implementationReceivedAmount' => $received($implementation), 'implementationCostAmount' => 0.0,
            'implementationRefundAmount' => $refunded($implementation), 'implementationAmount' => round($implementation->sum('creditAmount'), 2),
            'acquisitionCreditAmount' => $received($acquisition), 'acquisitionRefundAmount' => $refunded($acquisition),
            'acquisitionAmount' => round($acquisition->sum('creditAmount'), 2), 'actualAmount' => $total,
            'completionRate' => $target > 0 ? round($total / $target * 100, 2) : null];
    }
}
