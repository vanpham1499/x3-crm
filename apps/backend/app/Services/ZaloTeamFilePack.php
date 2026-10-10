<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;

/** Bounded streaming transport; each verified file survives an interrupted request. */
class ZaloTeamFilePack
{
    public const MAGIC = "ZTFILEPACK1\n";

    public const LIMIT = 268435456;

    public static function descriptor(array $value): array
    {
        $v = Validator::make($value, [
            'file' => ['required', 'regex:#^(manifest\.json|messages\.jsonl|blobs/[a-f0-9]{64})$#D'],
            'sha256' => 'required|regex:/^[a-f0-9]{64}$/D',
            'bytes' => 'required|integer|min:0|max:262144000',
        ])->validate();
        abort_if($v['file'] === 'manifest.json' && $v['bytes'] > 16777216, 413);
        abort_if(str_starts_with($v['file'], 'blobs/') && $v['file'] !== 'blobs/'.$v['sha256'], 422);

        return $v;
    }

    public function receive($in, string $directory, int $expected): array
    {
        abort_unless($expected >= strlen(self::MAGIC) && $expected <= self::LIMIT, 413);
        if (! is_dir($directory.'/blobs')) {
            mkdir($directory.'/blobs', 0700, true);
        }
        abort_unless(disk_free_space($directory) > $expected + 536870912, 507);
        abort_unless(fread($in, strlen(self::MAGIC)) === self::MAGIC, 422);
        $read = strlen(self::MAGIC);
        $seen = [];
        while ($read < $expected) {
            $line = fgets($in, 513);
            abort_unless(is_string($line) && str_ends_with($line, "\n"), 422, 'Incomplete file header');
            $read += strlen($line);
            $header = json_decode($line, true);
            abort_unless(is_array($header), 422);
            $v = self::descriptor($header);
            abort_if(isset($seen[$v['file']]) || count($seen) >= 128 || $read + $v['bytes'] > $expected, 422);
            $seen[$v['file']] = true;
            $temp = tempnam($directory, 'pack-');
            $out = fopen($temp, 'wb');
            $hash = hash_init('sha256');
            try {
                $remaining = $v['bytes'];
                while ($remaining > 0) {
                    $chunk = fread($in, min(1048576, $remaining));
                    abort_unless(is_string($chunk) && strlen($chunk) > 0, 422, 'Incomplete file');
                    $remaining -= strlen($chunk);
                    $read += strlen($chunk);
                    hash_update($hash, $chunk);
                    abort_unless(fwrite($out, $chunk) === strlen($chunk), 507);
                }
                abort_unless(hash_final($hash) === $v['sha256'], 422, 'File checksum mismatch');
                abort_unless(fflush($out) && fsync($out), 507);
                fclose($out);
                $out = null;
                abort_unless(rename($temp, $directory.'/'.$v['file']), 500);
            } finally {
                if (is_resource($out)) {
                    fclose($out);
                }
                if (is_file($temp)) {
                    unlink($temp);
                }
            }
        }
        abort_unless($read === $expected && fread($in, 1) === '', 422);

        return ['ok' => true, 'files' => count($seen), 'bytes' => $read];
    }
}
