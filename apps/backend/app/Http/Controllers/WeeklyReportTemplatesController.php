<?php

namespace App\Http\Controllers;

use App\Models\Service;
use App\Models\WeeklyReportTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WeeklyReportTemplatesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'manage' => ['sometimes', 'boolean'], 'search' => ['nullable', 'string', 'max:160'],
            'service_id' => ['nullable', 'integer', 'min:0'], 'category' => ['nullable', 'string', 'max:100'],
            'active' => ['nullable', 'boolean'], 'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $manage = $request->boolean('manage');
        abort_if($manage && ! $request->user()->hasPermission('weeklytemplate.manage'), 403);
        $query = WeeklyReportTemplate::query();
        if (! $manage) {
            $query->where('is_active', true);
        } elseif (isset($filters['active'])) {
            $query->where('is_active', $request->boolean('active'));
        }
        if (isset($filters['service_id'])) {
            $id = (int) $filters['service_id'];
            if ($id === 0) {
                $query->whereNull('service_id');
            } elseif ($manage) {
                $query->where('service_id', $id);
            } else {
                // Parent-service templates also apply to child services. Guard against bad cycles.
                $ids = [];
                while ($id && ! in_array($id, $ids, true)) {
                    $service = Service::find($id);
                    if (! $service) {
                        break;
                    }
                    $ids[] = $id;
                    $id = (int) $service->parent_id;
                }
                $query->where(fn ($q) => $q->whereNull('service_id')->orWhereIn('service_id', $ids));
            }
        }
        if ($search = trim($filters['search'] ?? '')) {
            $term = '%'.mb_strtolower($search).'%';
            $query->where(fn ($q) => $q->whereRaw('LOWER(title) LIKE ?', [$term])->orWhereRaw('LOWER(content) LIKE ?', [$term])->orWhereRaw('LOWER(usage_hint) LIKE ?', [$term]));
        }
        if ($category = $filters['category'] ?? '') {
            $query->where('category', $category);
        }
        $page = $query->orderBy('sort_order')->orderBy('id')->paginate(20);

        return $this->success(['items' => $page->items(), 'total' => $page->total(), 'page' => $page->currentPage(), 'lastPage' => $page->lastPage()]);
    }

    public function options(Request $request): JsonResponse
    {
        $categories = WeeklyReportTemplate::query()
            ->when(! $request->user()->hasPermission('weeklytemplate.manage'), fn ($q) => $q->where('is_active', true))
            ->distinct()->orderBy('category')->pluck('category');

        return $this->success([
            'services' => Service::where('is_active', true)->orderBy('sort_order')->orderBy('code')->get(['id', 'parent_id', 'code', 'name']),
            'categories' => $categories,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['created_by'] = $data['updated_by'] = $request->user()->id;

        return $this->success(WeeklyReportTemplate::create($data)->refresh(), 201);
    }

    public function selection(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array', 'min:1', 'max:20'], 'ids.*' => ['required', 'integer', 'distinct']]);
        $rows = WeeklyReportTemplate::whereIn('id', $data['ids'])->where('is_active', true)->get()->keyBy('id');
        abort_if($rows->count() !== count($data['ids']), 422, 'Có mẫu đã tắt hoặc không còn tồn tại. Vui lòng tải lại danh sách.');

        return $this->success(collect($data['ids'])->map(fn ($id) => $rows->get($id))->values());
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $data = $this->validated($request, true);

        return DB::transaction(function () use ($request, $id, $data): JsonResponse {
            $template = WeeklyReportTemplate::lockForUpdate()->findOrFail($id);
            abort_if($template->version !== (int) $data['version'], 409, 'Mẫu đã được thay đổi. Tải lại trước khi sửa.');
            unset($data['version']);
            $template->fill($data);
            $template->updated_by = $request->user()->id;
            $template->version++;
            $template->save();

            return $this->success($template);
        });
    }

    private function validated(Request $request, bool $update = false): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'service_id' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'category' => ['required', 'string', 'max:100'],
            'usage_hint' => ['nullable', 'string', 'max:2000'],
            'content' => ['required', 'string', 'max:10000'],
            'is_active' => ['required', 'boolean'], 'sort_order' => ['required', 'integer', 'min:0', 'max:100000'],
            'version' => [$update ? 'required' : 'prohibited', 'integer', 'min:1'],
        ]);
    }
}
