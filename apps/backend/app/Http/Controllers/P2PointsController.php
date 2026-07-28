<?php

namespace App\Http\Controllers;

use App\Http\Requests\P2\CreateP2PointRequest;
use App\Http\Requests\P2\UpdateP2PointRequest;
use App\Services\P2PointsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class P2PointsController extends Controller
{
    public function __construct(private readonly P2PointsService $points) {}

    public function index(Request $request): JsonResponse
    {
        $filters = [
            'keyword' => $request->query('keyword'),
            'userId' => $request->query('user_id'),
            'category' => $request->query('category'),
            'type' => $request->query('type'),
            'isApproved' => $request->has('is_approved') ? $request->boolean('is_approved') : null,
            'dateFrom' => $request->query('date_from'),
            'dateTo' => $request->query('date_to'),
        ];

        if ($request->query->has('page') || $request->query->has('per_page')) {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(100, max(1, (int) $request->query('per_page', 10)));
            $result = $this->points->findPaginated($filters, $perPage, $page);

            return $this->success($result['data'], 200, $result['meta']);
        }

        return $this->success($this->points->findAll($filters));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->points->findOne($id));
    }

    public function store(CreateP2PointRequest $request): JsonResponse
    {
        return $this->success($this->points->create($request->validatedData()), 201);
    }

    public function update(UpdateP2PointRequest $request, string $id): JsonResponse
    {
        return $this->success($this->points->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->points->remove($id));
    }

    public function approve(string $id): JsonResponse
    {
        return $this->success($this->points->approve($id));
    }
}
