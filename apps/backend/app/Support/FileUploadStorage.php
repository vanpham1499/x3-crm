<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class FileUploadStorage
{
    private static function getFrontendPublicPath(): string
    {
        return rtrim(
            env('MEDIA_PUBLIC_PATH', base_path('../frontend/public')),
            DIRECTORY_SEPARATOR.'/'
        );
    }

    /**
     * Moves the uploaded file into the frontend's public/uploads directory
     * (same static-serving scheme used by the media library) and returns
     * the stored file's metadata.
     */
    public static function store(UploadedFile $file, string $subdir): array
    {
        $now = now();
        $directory = sprintf('uploads/%s/%s/%s', $subdir, $now->format('Y'), $now->format('m'));
        $absoluteDirectory = self::getFrontendPublicPath()
            .DIRECTORY_SEPARATOR
            .str_replace('/', DIRECTORY_SEPARATOR, $directory);

        if (! is_dir($absoluteDirectory)) {
            mkdir($absoluteDirectory, 0775, true);
        }

        $originalName = $file->getClientOriginalName();
        $mimeType = $file->getMimeType();
        $fileSize = $file->getSize() ?: 0;
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
        $baseName = Str::slug(pathinfo($originalName, PATHINFO_FILENAME)) ?: 'file';
        $fileName = sprintf('%s-%s.%s', $baseName, Str::lower(Str::random(10)), $extension);

        $file->move($absoluteDirectory, $fileName);

        return [
            'fileName' => $fileName,
            'fileUrl' => '/'.$directory.'/'.$fileName,
            'originalName' => $originalName,
            'mimeType' => $mimeType,
            'fileSize' => $fileSize,
        ];
    }

    public static function delete(?string $fileUrl): bool
    {
        $path = parse_url((string) $fileUrl, PHP_URL_PATH);
        $relativePath = ltrim((string) $path, '/');

        if (! str_starts_with($relativePath, 'uploads/') || str_contains($relativePath, '..')) {
            return false;
        }

        $absolutePath = self::getFrontendPublicPath()
            .DIRECTORY_SEPARATOR
            .str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

        return ! is_file($absolutePath) || unlink($absolutePath);
    }
}
