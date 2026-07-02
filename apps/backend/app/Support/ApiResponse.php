<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

trait ApiResponse
{
    protected function success(mixed $data = null, int $status = 200, array $meta = []): JsonResponse
    {
        if ($meta !== []) {
            return response()->json([
                'data' => $data,
                'meta' => $meta,
            ], $status);
        }

        return response()->json($data, $status);
    }

    protected function message(string $message, int $status = 200, array $extra = []): JsonResponse
    {
        return response()->json(array_merge(['message' => $message], $extra), $status);
    }

    protected function error(string $message, int $status = 400, array $errors = []): JsonResponse
    {
        $payload = ['message' => $message];

        if ($errors !== []) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }
}
