<?php

namespace App\Services;

use Symfony\Component\Process\Process;

/** Native conversion on the archive VPS; source originals are never modified. */
class ZaloTeamNativePreview
{
    public function available(): bool
    {
        return PHP_OS_FAMILY === 'Linux' && is_executable('/usr/bin/djxl');
    }

    public function create(array $blob, string $root): array
    {
        $locks = config('zalo_team.archive_path').'/locks';
        if (! is_dir($locks)) {
            mkdir($locks, 0700, true);
        }
        for ($slot = 0; $slot < 2; $slot++) {
            $lock = fopen($locks.'/native-preview-'.$slot.'.lock', 'c');
            if (flock($lock, LOCK_EX | LOCK_NB)) {
                try {
                    return $this->generate($blob, $root);
                } finally {
                    flock($lock, LOCK_UN);
                    fclose($lock);
                }
            }
            fclose($lock);
        }
        throw new \RuntimeException('FILE_PREVIEW_BUSY');
    }

    private function generate(array $blob, string $root): array
    {
        if (! $this->available()) {
            throw new \RuntimeException('FILE_PREVIEW_UNAVAILABLE');
        }
        if ($blob['bytes'] > 16777216) {
            throw new \RuntimeException('FILE_PREVIEW_LIMIT');
        }
        $dir = $root.'/previews';
        if (! is_dir($dir)) {
            mkdir($dir, 0700, true);
        }
        $file = $dir.'/'.$blob['hash'].'.jpg';
        if (! is_file($file)) {
            $temp = $dir.'/'.$blob['hash'].'.'.bin2hex(random_bytes(6)).'.jpg';
            try {
                // Fixed script, all paths passed as arguments; cap decoder address space,
                // output size, CPU and wall time independently from PHP memory.
                $p = new Process(['/bin/sh', '-c', 'ulimit -v 524288; ulimit -f 32768; ulimit -t 20; exec /usr/bin/djxl "$1" "$2" --num_threads=2 --quiet', '--', $blob['path'], $temp], null, null, null, 30);
                $p->run();
                if (! $p->isSuccessful() || ! is_file($temp)) {
                    throw new \RuntimeException('FILE_PREVIEW_FAILED');
                }
                $info = @getimagesize($temp);
                if (! $info || $info[2] !== IMAGETYPE_JPEG || $info[0] * $info[1] > 40000000 || filesize($temp) > 16777216) {
                    throw new \RuntimeException('FILE_PREVIEW_LIMIT');
                }
                if (! rename($temp, $file)) {
                    throw new \RuntimeException('FILE_PREVIEW_FAILED');
                }
            } finally {
                if (is_file($temp)) {
                    unlink($temp);
                }
            }
        }
        $info = @getimagesize($file);
        if (! $info || $info[2] !== IMAGETYPE_JPEG || $info[0] * $info[1] > 40000000 || filesize($file) > 16777216) {
            throw new \RuntimeException('FILE_PREVIEW_FAILED');
        }

        return ['messageId' => $blob['messageId'], 'slot' => str_replace('.url', '.preview', $blob['slot']),
            'path' => $file, 'hash' => hash_file('sha256', $file), 'bytes' => filesize($file), 'mime' => 'image/jpeg'];
    }
}
