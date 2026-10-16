<?php

namespace App\Services;

use App\Models\Project;
use App\Repositories\{ProjectRepository, ProjectCostRepository};
use Illuminate\Database\Eloquent\Builder;

/** Bounded reads: list pages contain summaries; source/payment details are requested separately. */
final class PartnerFinanceReadService
{
    public function __construct(private readonly PartnerFinanceService $finance) {}

    public function projects(string $keyword = ''): Builder
    {
        $user = auth()->user();
        $revenue = app(ProjectRepository::class)->filteredQuery([], $user)->setEagerLoads([])->reorder()->select('projects.id');
        if (!$user->hasPermission('cost.approve_all') && !$user->hasPermission('cost.fund_all')) {
            $revenue->where(function (Builder $q) use ($user): void {
                $q->whereRaw('false');
                foreach (['approve', 'fund'] as $action) {
                    if ($user->hasPermission("cost.$action")) $q->orWhere('projects.manager_user_id', $user->id)->orWhere('projects.sales_user_id', $user->id);
                    foreach (['department' => $user->accessibleDepartmentIds(), 'team' => $user->accessibleTeamIds()] as $scope => $ids) {
                        if (!$user->hasPermission("cost.{$action}_{$scope}") || !$ids) continue;
                        foreach (['managerUser', 'salesUser'] as $relation) $q->orWhereHas($relation, fn ($u) => $u->whereIn($scope.'_id', $ids));
                    }
                }
            });
        }
        $costProjects = app(ProjectCostRepository::class)->financeProjectIdsQuery($user);
        return Project::query()->where(fn ($q) => $q->whereIn('id', $revenue)->orWhereIn('id', $costProjects))
            ->when(trim($keyword) !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('project_code', 'ilike', '%'.trim($keyword).'%')->orWhere('project_name', 'ilike', '%'.trim($keyword).'%')));
    }

    public function page(array $filters): array
    {
        $p = $this->projects($filters['keyword'] ?? '')->orderBy('project_code')->orderBy('id')
            ->paginate($filters['per_page'] ?? 10, ['id'], 'page', $filters['page'] ?? 1);
        $report = $this->finance->report($filters['period'], $p->pluck('id')->all());
        $rows = collect($report['rows'])->keyBy('id');
        $report['rows'] = $p->getCollection()->map(function ($project) use ($rows) {
            $row = $rows->get($project->id);
            if (!$row) return null;
            unset($row['costs'], $row['quotations']);
            return $row;
        })->filter()->values()->all();
        $report['pagination'] = ['page' => $p->currentPage(), 'perPage' => $p->perPage(), 'total' => $p->total(), 'totalPages' => $p->lastPage()];
        return $report;
    }

    public function detail(int $id, string $period): array
    {
        abort_unless($this->projects()->whereKey($id)->exists(), 403);
        $rows = $this->finance->report($period, [$id])['rows'];
        abort_if(!$rows, 404);
        return $rows[0];
    }

    private function eachProject(array $filters, callable $callback): void
    {
        // Aggregations scan in bounded batches, never hydrate the entire project graph at once.
        $this->projects($filters['keyword'] ?? '')->select('id')->chunkById(100, function ($batch) use ($filters, $callback): void {
            foreach ($this->finance->report($filters['period'], $batch->pluck('id')->all())['rows'] as $row) $callback($row);
        });
    }

    private function candidates(array $project, string $period): array
    {
        $rows = [];
        foreach (['quotations' => 'revenue', 'costs' => 'cost'] as $group => $type) {
            foreach ($project[$group] as $source) {
                $s = $source['suggestion'];
                if (!in_array($s['status'], ['ready', 'review', 'waiting'], true)) continue;
                if ($s['status'] === 'ready' && !in_array($period, array_column($s['allocations'], 'period'), true)) continue;
                $rows[] = ['key' => $type.':'.$source['id'], 'type' => $type, 'id' => $source['id'],
                    'projectId' => $project['id'], 'project' => $project['code'], 'title' => $source['code'] ?? $source['partner'],
                    'amount' => $source['amount'], 'suggestion' => $s, 'canConfirm' => $project['canConfirm']];
            }
        }
        return $rows;
    }

    public function summary(array $filters): array
    {
        $totals = array_fill_keys(['revenue', 'cost', 'profit', 'payable', 'paid', 'received', 'review'], 0);
        $counts = array_fill_keys(['ready', 'review', 'waiting'], 0);
        $partialScope = false;
        $this->eachProject($filters, function ($row) use (&$totals, &$counts, &$partialScope, $filters): void {
            foreach (['revenue' => 'revenue', 'cost' => 'cost', 'profit' => 'profit', 'payable' => 'payable', 'paid' => 'paidInPeriod', 'received' => 'receivedInPeriod', 'review' => 'reviewCount'] as $key => $field) $totals[$key] += $row[$field];
            foreach ($this->candidates($row, $filters['period']) as $candidate) $counts[$candidate['suggestion']['status']]++;
            $partialScope = $partialScope || $row['partialScope'];
        });
        return compact('totals', 'counts', 'partialScope');
    }

    public function suggestions(array $filters): array
    {
        $page = (int) ($filters['page'] ?? 1);
        $size = (int) ($filters['per_page'] ?? 10);
        $total = 0;
        $rows = [];
        $this->eachProject($filters, function ($project) use (&$rows, &$total, $filters, $page, $size): void {
            foreach ($this->candidates($project, $filters['period']) as $candidate) {
                if ($candidate['suggestion']['status'] !== ($filters['status'] ?? 'ready')) continue;
                if (($filters['confirmable_only'] ?? false) && !$candidate['canConfirm']) continue;
                if ($total >= ($page - 1) * $size && count($rows) < $size) $rows[] = $candidate;
                $total++;
            }
        });
        return ['rows' => $rows, 'pagination' => ['page' => $page, 'perPage' => $size, 'total' => $total, 'totalPages' => max(1, (int) ceil($total / $size))]];
    }

    public function selection(array $filters): array
    {
        // Server controls eligibility and the batch cap, regardless of client pagination/status.
        $result = $this->suggestions(array_replace($filters, [
            'status' => 'ready', 'confirmable_only' => true, 'page' => 1, 'per_page' => 500,
        ]));
        return ['rows' => $result['rows'], 'total' => $result['pagination']['total'], 'limit' => 500];
    }
}
