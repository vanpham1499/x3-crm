<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/** Local file reader. The remote service remains the only archive writer. */
class ZaloTeamFileImport
{
    private array $lastPulse = [];

    private function picker(string $root): ?array
    {
        if (! is_file($root.'/picker.json')) {
            return null;
        }
        $p = json_decode(file_get_contents($root.'/picker.json'), true);
        if (! is_array($p) || ! isset($p['id'], $p['at'])) {
            return null;
        }
        $result = is_file($root.'/picker-result.json') ? json_decode(file_get_contents($root.'/picker-result.json'), true) : null;
        if (($result['id'] ?? null) === $p['id']) {
            if (($result['state'] ?? '') === 'selected' && time() - $p['at'] < 1800) {
                $source = realpath($result['path'] ?? '');
                if ($source && is_file($source) && ! is_link($source) && preg_match('/^[A-Za-z]:[\\\\\/]/', $source) && str_ends_with(strtolower($source), '.zl.zip')) {
                    return ['id' => $p['id'], 'state' => 'selected', 'path' => $source, 'fileName' => basename($source), 'bytes' => filesize($source)];
                }
                return ['id' => $p['id'], 'state' => 'error', 'error' => 'File không còn đọc được. Vui lòng chọn lại.'];
            }
            if (($result['state'] ?? '') === 'cancelled') {
                return ['id' => $p['id'], 'state' => 'cancelled'];
            }
            return ['id' => $p['id'], 'state' => 'error', 'error' => 'Chưa chọn được file. Vui lòng thử lại.'];
        }
        return time() - $p['at'] < 200
            ? ['id' => $p['id'], 'state' => 'pending']
            : ['id' => $p['id'], 'state' => 'error', 'error' => 'Cửa sổ chọn file đã hết thời gian. Bấm chọn file để mở lại.'];
    }

    protected function launchPicker(string $root, string $id): void
    {
        (new Process(['node', base_path('integrations/zalo/file-import/pick-file.cjs'), $root, $id], base_path(), getenv()))->mustRun();
    }

    private function root(string $owner): string
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $owner)) {
            throw new \InvalidArgumentException('Invalid owner');
        }
        $root = storage_path('app/private/zalo-file-import/'.$owner);
        if (! is_dir($root)) {
            mkdir($root, 0700, true);
        }

        return $root;
    }

    private function change(string $owner, callable $fn): mixed
    {
        $root = $this->root($owner);
        $lock = fopen($root.'/state.lock', 'c');
        flock($lock, LOCK_EX);
        try {
            $s = is_file($root.'/state.json') ? json_decode(file_get_contents($root.'/state.json'), true, 64, JSON_THROW_ON_ERROR) : ['state' => 'idle'];
            $result = $fn($s);
            file_put_contents($root.'/state.tmp', ZaloTeamArchive::json($s), LOCK_EX);
            if (! rename($root.'/state.tmp', $root.'/state.json')) {
                throw new \RuntimeException('FILE_STATE_WRITE_FAILED');
            }

            return $result;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function update(string $owner, array $fields): void
    {
        $this->change($owner, function (&$s) use ($fields) {
            $s = array_replace($s, $fields, ['updatedAt' => time() * 1000]);
        });
    }

    public function status(User $u): array
    {
        $owner = ZaloTeamArchive::owner($u);
        $s = $this->change($owner, fn (&$s) => $s);
        $root = $this->root($owner);
        $lock = fopen($root.'/worker.lock', 'c');
        $available = flock($lock, LOCK_EX | LOCK_NB);
        if ($available) {
            flock($lock, LOCK_UN);
        }
        fclose($lock);
        if ($available && in_array($s['state'], ['queued-index', 'queued-import', 'queued-unlock', 'indexing', 'importing', 'unlocking']) && time() * 1000 - ($s['updatedAt'] ?? 0) > 30000) {
            $this->update($owner, ['state' => 'paused', 'error' => 'Tiến trình đã dừng. Bấm Tiếp tục để chạy từ phần đã lưu.']);
            $s['state'] = 'paused';
            $s['error'] = 'Tiến trình đã dừng. Bấm Tiếp tục để chạy từ phần đã lưu.';
        }
        $out = array_intersect_key($s, array_flip(['state', 'accountId', 'accountName', 'fileName', 'fileBytes', 'summary', 'phase', 'current', 'progress', 'results', 'uploadedBytes', 'error', 'errorCode', 'updatedAt', 'queueCount', 'selected', 'retry', 'lastBatch', 'performance']));
        $catalog = is_file($root.'/catalog.json') ? json_decode(file_get_contents($root.'/catalog.json'), true) : [];

        $picker = $this->picker($root);
        if ($picker) {
            unset($picker['path']); // Only a short-lived owner-bound selection ID crosses the API.
        }
        return $out + ['picker' => $picker, 'conversations' => $catalog['conversations'] ?? [], 'supported' => PHP_OS_FAMILY === 'Windows' && app()->environment('local'), 'uploadLimit' => $s['uploadLimit'] ?? null,
            'stopRequested' => ! $available && is_file($root.'/stop')];
    }

    public function command(User $u, array $v): array
    {
        abort_unless(PHP_OS_FAMILY === 'Windows' && app()->environment('local'), 409, 'Mở trang này trên máy Windows chứa file xuất.');
        $owner = ZaloTeamArchive::owner($u);
        $root = $this->root($owner);
        if ($v['kind'] === 'file-status') {
            return $this->status($u);
        }
        if ($v['kind'] === 'file-stop') {
            file_put_contents($root.'/stop', '1');

            return $this->status($u);
        }
        $commandLock = fopen($root.'/command.lock', 'c');
        abort_unless(flock($commandLock, LOCK_EX | LOCK_NB), 409, 'Một yêu cầu khác đang được xử lý.');
        $workerLock = fopen($root.'/worker.lock', 'c');
        try {
            abort_unless(flock($workerLock, LOCK_EX | LOCK_NB), 409, 'Đang hoàn tất đợt nhập. Vui lòng chờ.');
            $state = $this->change($owner, fn (&$s) => $s);
            abort_if(in_array($state['state'], ['queued-index', 'queued-unlock', 'queued-import', 'indexing', 'unlocking', 'importing']), 409, 'Đang xử lý file. Dừng trước khi đổi lựa chọn.');
            if ($v['kind'] === 'file-pick') {
                $accounts = app(ZaloTeamCatalog::class)->command($u, ['action' => 'status'])['accounts'] ?? [];
                abort_unless(collect($accounts)->contains(fn ($a) => $a['id'] === ($v['accountId'] ?? 0)), 403, 'Tài khoản không thuộc bạn.');
                abort_if(($this->picker($root)['state'] ?? '') === 'pending', 409, 'Cửa sổ chọn file đang mở.');
                $id = (string) \Illuminate\Support\Str::uuid();
                file_put_contents($root.'/picker.json', json_encode(['id' => $id, 'at' => time()]), LOCK_EX);
                try {
                    $this->launchPicker($root, $id);
                } catch (\Throwable $e) {
                    file_put_contents($root.'/picker-result.json', json_encode(['id' => $id, 'state' => 'error']), LOCK_EX);
                }
                return $this->status($u);
            } elseif ($v['kind'] === 'file-open') {
                $picked = $this->picker($root);
                if (isset($v['selectionId'])) {
                    abort_unless(($picked['state'] ?? '') === 'selected' && hash_equals($picked['id'], $v['selectionId']), 422, 'Chọn lại file trước khi đọc.');
                }
                $source = realpath(isset($v['selectionId']) ? $picked['path'] : ($v['path'] ?? ''));
                abort_unless($source && is_file($source) && ! is_link($source) && preg_match('/^[A-Za-z]:[\\\\\/]/', $source) && str_ends_with(strtolower($source), '.zl.zip'), 422, 'Chọn file xuất Zalo .zl.zip trên ổ đĩa của máy này.');
                $accounts = app(ZaloTeamCatalog::class)->command($u, ['action' => 'status'])['accounts'] ?? [];
                $a = collect($accounts)->first(fn ($a) => $a['id'] === ($v['accountId'] ?? 0));
                abort_unless($a && preg_match('/^\d{1,30}$/D', $a['externalId'] ?? ''), 403, 'Tài khoản không thuộc bạn.');
                // Only derived file keys are persisted, encrypted using this local app key.
                $hasKey = is_file($root.'/key-'.$a['externalId'].'.enc');
                foreach (['catalog.json', 'index.sqlite', 'stop'] as $file) {
                    if (is_file($root.'/'.$file)) {
                        unlink($root.'/'.$file);
                    }
                }
                if (is_dir($root.'/bundle')) {
                    File::deleteDirectory($root.'/bundle');
                }
                $this->change($owner, function (&$s) use ($u, $a, $source, $hasKey) {
                    $s = ['state' => $hasKey ? 'queued-index' : 'needs-unlock', 'userId' => $u->id, 'accountId' => $a['id'], 'externalId' => $a['externalId'], 'accountName' => $a['name'],
                        'source' => $source, 'fileName' => basename($source), 'fileBytes' => filesize($source), 'results' => [], 'uploadedBytes' => 0, 'updatedAt' => time() * 1000];
                });
            } elseif ($v['kind'] === 'file-unlock') {
                abort_unless(($v['confirm'] ?? false) && in_array($state['state'], ['needs-unlock', 'error', 'paused']), 422, 'Xác nhận mở khóa file bằng tài khoản Zalo PC.');
                $this->update($owner, ['state' => 'queued-unlock', 'error' => null, 'errorCode' => null]);
            } elseif ($v['kind'] === 'file-start') {
                $catalog = is_file($root.'/catalog.json') ? json_decode(file_get_contents($root.'/catalog.json'), true) : null;
                if (! $catalog) {
                    abort_unless(is_file($root.'/key-'.($state['externalId'] ?? '').'.enc'), 409, 'Mở khóa file trước.');
                    $this->update($owner, ['state' => 'queued-index', 'error' => null, 'errorCode' => null]);
                } else {
                    $ids = ! empty($v['resume']) ? array_column($state['queue'] ?? [], 'conversationId') : (! empty($v['all']) ? array_column($catalog['conversations'], 'conversationId') : ($v['conversations'] ?? []));
                    abort_unless($ids && ! array_diff($ids, array_column($catalog['conversations'], 'conversationId')), 422, 'Chọn hội thoại có trong file.');
                    $queue = ! empty($v['resume']) ? $state['queue'] : array_map(fn ($id) => ['conversationId' => $id, 'after' => 0], array_values(array_unique($ids)));
                    $fields = ['state' => 'queued-import', 'queue' => $queue, 'queueCount' => count($queue), 'error' => null, 'errorCode' => null,
                        'uploadLimit' => $v['uploadLimit'] ?? null];
                    if (empty($v['resume'])) {
                        $fields += ['results' => [], 'selected' => array_values(array_unique($ids))];
                    }
                    $this->update($owner, $fields);
                }
            }
            if (is_file($root.'/stop')) {
                unlink($root.'/stop');
            }
            $current = $this->change($owner, fn (&$s) => $s);
            // Release before launching; queued state prevents another command changing the job.
            flock($workerLock, LOCK_UN);
            if (str_starts_with($current['state'], 'queued-')) {
                try {
                    // HTTP SAPI filters $_SERVER; Symfony's inferred environment can omit
                    // SystemRoot, which makes Node's Windows crypto initialization fail.
                    (new Process(['node', base_path('integrations/zalo/file-import/launch.cjs'), PHP_BINARY, base_path(), $owner, $root.'/worker.log'], base_path(), getenv()))->mustRun();
                } catch (\Throwable $e) {
                    Log::warning('Zalo file reader launch failed', ['reason' => $e->getMessage()]);
                    $this->update($owner, ['state' => 'paused', 'error' => 'Chưa khởi động được bộ đọc file. Bấm Tiếp tục để thử lại.', 'errorCode' => 'FILE_LAUNCH_FAILED']);
                }
            }

            return $this->status($u);
        } finally {
            flock($workerLock, LOCK_UN);
            fclose($workerLock);
            flock($commandLock, LOCK_UN);
            fclose($commandLock);
        }
    }

    private function pulse(string $owner): void
    {
        if (is_file($this->root($owner).'/stop')) {
            throw new \RuntimeException('FILE_STOPPED');
        }
        if (microtime(true) - ($this->lastPulse[$owner] ?? 0) >= 1) {
            $this->update($owner, []);
            $this->lastPulse[$owner] = microtime(true);
        }
    }

    private function remoteStep(string $owner, string $phase, callable $operation): mixed
    {
        $this->update($owner, ['phase' => $phase, 'retry' => null]);

        return app(ZaloTeamFileImportRetry::class)->run($operation, fn () => $this->pulse($owner),
            fn ($retry) => $this->update($owner, ['phase' => $retry ? 'waiting' : $phase, 'retry' => $retry]));
    }

    private function node(string $owner, string $script, array $input, ?string $action = null): array
    {
        $args = ['node', '--disable-warning=ExperimentalWarning', '--max-old-space-size=256', base_path('integrations/zalo/file-import/'.$script)];
        if ($action) {
            $args[] = $action;
        }
        $p = new Process($args, base_path('../..'), getenv(), ZaloTeamArchive::json($input), 1800);
        $p->start();
        $buffer = '';
        $result = null;
        try {
            while ($p->isRunning()) {
                $this->pulse($owner);
                $p->checkTimeout();
                $buffer .= $p->getIncrementalOutput();
                if ($action) {
                    while (($pos = strpos($buffer, "\n")) !== false) {
                        $row = json_decode(substr($buffer, 0, $pos), true);
                        $buffer = substr($buffer, $pos + 1);
                        if ($row) {
                            if (! empty($row['done'])) {
                                $result = $row;
                            } else {
                                $this->update($owner, ['progress' => $row, 'phase' => $row['phase'] ?? $action]);
                            }
                        }
                    }
                }
                usleep(250000);
            }
            $buffer .= $p->getIncrementalOutput();
            if (! $p->isSuccessful()) {
                $err = $p->getErrorOutput();
                preg_match('/FATAL ERROR:[^\r\n]{0,200}|RuntimeError:[^\r\n]{0,100}|(?:FILE_|PC_)[A-Z_]+/', $err, $diagnostic);
                $this->update($owner, ['readerExit' => $p->getExitCode(), 'readerDiagnostic' => $diagnostic[0] ?? 'No diagnostic output']);
                preg_match('/FILE_[A-Z_]+/', $err, $matches);
                throw new \RuntimeException($matches[0] ?? 'FILE_PROCESS_FAILED');
            }
            foreach (explode("\n", trim($buffer)) as $line) {
                if ($row = json_decode($line, true)) {
                    $result = $row;
                }
            }
            if (! $result) {
                throw new \RuntimeException('FILE_PROCESS_FAILED');
            }

            return $result;
        } finally {
            if ($p->isRunning()) {
                $p->stop(2);
            } $p->clearOutput();
            $p->clearErrorOutput();
        }
    }

    public function work(string $owner): void
    {
        if (PHP_OS_FAMILY !== 'Windows' || ! app()->environment('local')) {
            throw new \RuntimeException('Local reader required');
        }
        $root = $this->root($owner);
        $lock = fopen($root.'/worker.lock', 'c');
        if (! flock($lock, LOCK_EX | LOCK_NB)) {
            fclose($lock);

            return;
        }
        try {
            $s = $this->change($owner, fn (&$s) => $s);
            $u = User::findOrFail($s['userId']);
            if (ZaloTeamArchive::owner($u) !== $owner) {
                throw new \RuntimeException('FILE_ACCOUNT_MISMATCH');
            }
            $keyFile = $root.'/key-'.$s['externalId'].'.enc';
            if ($s['state'] === 'queued-unlock') {
                $this->update($owner, ['state' => 'unlocking', 'phase' => 'unlocking']);
                $lease = $root.'/lease.json';
                $install = config('zalo_team.pc_install');
                $script = base_path('integrations/zalo/pc/session.ps1');
                try {
                    (new Process(['powershell', '-NoProfile', '-File', $script, '-Action', 'Open', '-Install', $install, '-Lease', $lease], null, null, null, 60))->mustRun();
                    $secret = $this->node($owner, 'unlock.mjs', ['source' => $s['source'], 'accountId' => $s['externalId'], 'install' => $install]);
                    file_put_contents($keyFile, Crypt::encryptString(ZaloTeamArchive::json($secret)), LOCK_EX);
                } finally {
                    (new Process(['powershell', '-NoProfile', '-File', $script, '-Action', 'Close', '-Install', $install, '-Lease', $lease], null, null, null, 60))->mustRun();
                }
                $s['state'] = 'queued-index';
            }
            try {
                $secret = json_decode(Crypt::decryptString(file_get_contents($keyFile)), true, 64, JSON_THROW_ON_ERROR);
            } catch (DecryptException $e) {
                throw new \RuntimeException('FILE_KEY_MISMATCH');
            }
            $input = ['source' => $s['source'], 'accountId' => $s['externalId'], 'accountName' => $s['accountName'], 'secret' => $secret, 'root' => $root];
            if ($s['state'] === 'queued-index') {
                $this->update($owner, ['state' => 'indexing', 'phase' => 'indexing', 'error' => null]);
                $names = [];
                try {
                    foreach (['friends', 'groups'] as $kind) {
                        $list = app(ZaloTeamCatalog::class)->command($u, ['action' => 'directory', 'accountId' => $s['accountId'], 'directory' => ['kind' => $kind]]);
                        foreach ($list['items'] ?? [] as $item) {
                            $names[(string) ($item['conversationId'] ?? $item['id'])] = $item['name'];
                        }
                    }
                } catch (\Throwable) { /* File remains readable offline; native dName is the fallback. */
                }
                $result = $this->node($owner, 'import.mjs', $input + ['names' => $names], 'index');
                $this->update($owner, ['state' => 'ready', 'phase' => null, 'summary' => array_intersect_key($result, array_flip(['messages', 'duplicates', 'members', 'scanned'])), 'progress' => null]);

                return;
            }
            if ($s['state'] !== 'queued-import') {
                return;
            }
            $remote = app(ZaloTeamPcRemote::class);
            if (! $remote->enabled()) {
                throw new \RuntimeException('FILE_REMOTE_REQUIRED');
            }
            $catalog = json_decode(file_get_contents($root.'/catalog.json'), true);
            $conversations = array_column($catalog['conversations'], null, 'conversationId');
            $sources = [];
            $runStarted = microtime(true);
            $runBytes = $s['uploadedBytes'] ?? 0;
            $runMessages = 0;
            $this->update($owner, ['state' => 'importing', 'error' => null, 'retry' => null]);
            while ($s = $this->change($owner, fn (&$s) => $s)) {
                $this->pulse($owner);
                if (! $s['queue']) {
                    break;
                }
                $task = $s['queue'][0];
                $c = $conversations[$task['conversationId']];
                $started = microtime(true);
                $prepared = $sources[$c['conversationId']] ??= $this->remoteStep($owner, 'preparing', fn () => $remote->call($u, 'prepare', ['fileImport' => true, 'accountId' => $s['accountId'], 'externalId' => $s['externalId'], 'conversationId' => $c['conversationId'], 'name' => $c['name']], fn () => $this->pulse($owner)));
                $source = $prepared['source'];
                $this->update($owner, ['current' => $c['name'], 'phase' => 'extracting', 'progress' => null, 'queueCount' => count($s['queue'])]);
                $bundle = $root.'/bundle';
                clearstatcache(true, $s['source']);
                if (filesize($s['source']) !== $catalog['sourceBytes'] || filemtime($s['source']) !== (int) floor($catalog['modified'] / 1000)) {
                    throw new \RuntimeException('FILE_CHANGED');
                }
                $batchKey = hash('sha256', ZaloTeamArchive::json([$s['source'], $catalog['sourceBytes'], $catalog['modified'], $task, ! empty($prepared['serverPreview']), 'native-preview-v1']));
                $cache = is_file($bundle.'/result.json') ? json_decode(file_get_contents($bundle.'/result.json'), true) : null;
                $extractStarted = microtime(true);
                if (($cache['key'] ?? '') === $batchKey && is_file($bundle.'/manifest.json') && hash_file('sha256', $bundle.'/manifest.json') === ($cache['manifest'] ?? '')) {
                    $result = $cache['result'];
                } else {
                    if (is_dir($bundle)) {
                        File::deleteDirectory($bundle);
                    }
                    $result = $this->node($owner, 'import.mjs', $input + ['serverPreview' => ! empty($prepared['serverPreview']), 'batchMessages' => 1000, 'batchBytes' => 134217728, 'conversationId' => $c['conversationId'], 'name' => $c['name'], 'after' => $task['after'], 'budget' => empty($s['uploadLimit']) ? null : max(1, $s['uploadLimit'] - ($s['uploadedBytes'] ?? 0))], 'build');
                    file_put_contents($bundle.'/result.json', ZaloTeamArchive::json(['key' => $batchKey, 'manifest' => hash_file('sha256', $bundle.'/manifest.json'), 'result' => $result]), LOCK_EX);
                }
                $extractMs = (microtime(true) - $extractStarted) * 1000;
                $this->update($owner, ['phase' => 'uploading', 'progress' => ['processed' => $result['messages'], 'files' => $result['files']]]);
                $transferStarted = microtime(true);
                $saved = $this->remoteStep($owner, 'uploading', fn () => $remote->upload($u, $source, $bundle, fn () => $this->pulse($owner), function (int $bytes) use ($owner) {
                    $this->change($owner, function (&$s) use ($bytes) {
                        if (! empty($s['uploadLimit']) && ($s['uploadedBytes'] ?? 0) + $bytes > $s['uploadLimit']) {
                            throw new \RuntimeException('FILE_UPLOAD_LIMIT');
                        }
                    });
                }, function (int $bytes) use ($owner) {
                    $this->change($owner, function (&$s) use ($bytes) {
                        $s['uploadedBytes'] = ($s['uploadedBytes'] ?? 0) + $bytes;
                    });
                }));
                $runMessages += $result['messages'];
                $result['files'] += $saved['summary']['generatedPreviews'] ?? 0;
                $result['missing'] += count($saved['summary']['previewErrors'] ?? []);
                $result['issues'] = array_merge($result['issues'] ?? [], $saved['summary']['previewErrors'] ?? []);
                $this->change($owner, function (&$s) use ($c, $result, $saved) {
                    $prior = $s['results'][$c['conversationId']] ?? ['name' => $c['name'], 'messages' => 0, 'added' => 0, 'files' => 0, 'missing' => 0];
                    foreach (['messages', 'files', 'missing'] as $k) {
                        $prior[$k] += $result[$k];
                    }$prior['added'] += ! empty($saved['replayed']) ? 0 : ($saved['summary']['added'] ?? 0);
                    $prior['issues'] = array_slice(array_merge($prior['issues'] ?? [], $result['issues'] ?? []), 0, 100);
                    $prior['complete'] = ! $result['hasMore'];
                    $s['results'][$c['conversationId']] = $prior;
                    if ($result['hasMore']) {
                        $s['queue'][0]['after'] = $result['after'];
                    } else {
                        array_shift($s['queue']);
                    }
                });
                $this->change($owner, function (&$s) use ($result, $extractMs, $transferStarted, $started, $runMessages, $runStarted, $runBytes) {
                    $s['lastBatch'] = ['messages' => $result['messages'], 'bytes' => $result['bytes'], 'extractMs' => round($extractMs), 'saveMs' => round((microtime(true) - $transferStarted) * 1000), 'totalMs' => round((microtime(true) - $started) * 1000), 'reader' => $result['timings'] ?? null];
                    $elapsed = microtime(true) - $runStarted;
                    $s['performance'] = ['messages' => $runMessages, 'elapsedSeconds' => round($elapsed), 'messagesPerSecond' => round($runMessages / max(1, $elapsed), 1), 'bytesPerSecond' => round((($s['uploadedBytes'] ?? 0) - $runBytes) / max(1, $elapsed))];
                });
                $cleanup = ['source' => $source, 'batch' => hash_file('sha256', $bundle.'/manifest.json')];
                $this->change($owner, function (&$s) use ($cleanup) {
                    $s['pendingCleanups'] = array_values(array_filter($s['pendingCleanups'] ?? [], fn ($v) => ! empty($v['source'])));
                    $s['pendingCleanups'][] = $cleanup;
                });
                $cleanups = $this->change($owner, fn (&$s) => $s['pendingCleanups']);
                foreach ($cleanups as $item) {
                    try {
                        $remote->call($u, 'checked', $item + ['receipts' => [], 'checks' => []], fn () => $this->pulse($owner));
                    } catch (ZaloTeamImportTransportException) {
                        break;
                    }
                    $this->change($owner, function (&$s) use ($item) {
                        $s['pendingCleanups'] = array_values(array_filter($s['pendingCleanups'], fn ($v) => $v !== $item));
                    });
                }
                File::deleteDirectory($bundle);
            }
            $this->update($owner, ['state' => 'complete', 'phase' => null, 'current' => null, 'progress' => null, 'queueCount' => 0]);
        } catch (\Throwable $e) {
            $this->update($owner, ['failureLocation' => basename($e->getFile()).':'.$e->getLine(), 'failureType' => get_class($e)]);
            $messages = ['FILE_STOPPED' => 'Đã dừng. Phần đã lưu được giữ lại.', 'FILE_UPLOAD_LIMIT' => 'Đã tới giới hạn tải lên đã chọn. Tăng giới hạn hoặc chọn Không giới hạn rồi tiếp tục.',
                'PC_ARCHIVE_BUSY' => 'Kho đang bận lâu hơn dự kiến. Phần đã lưu được giữ lại; có thể bấm Tiếp tục.',
                'PC_REMOTE_NETWORK' => 'Chưa kết nối lại được VPS sau nhiều lần tự thử. Kiểm tra kết nối rồi bấm Tiếp tục.',
                'PC_REMOTE_UNAUTHORIZED' => 'Quyền truy cập đã thay đổi. Đăng nhập lại trước khi tiếp tục.',
                'FILE_DISK_FULL' => 'Kho trên server sắp hết dung lượng. Giải phóng hoặc tăng dung lượng rồi tiếp tục.',
                'FILE_KEY_MISMATCH' => 'Khóa không khớp file. Chọn đúng tài khoản và mở khóa lại.', 'FILE_ACCOUNT_MISMATCH' => 'Tài khoản đang mở trên Zalo PC khác tài khoản đã chọn.',
                'FILE_KEY_UNAVAILABLE' => 'Chưa đọc được khóa. Đăng nhập đúng tài khoản trên Zalo PC rồi thử lại.', 'FILE_CHANGED' => 'File nguồn đã thay đổi. Mở lại file để kiểm tra.',
                'FILE_DUPLICATE_CONFLICT' => 'File chứa tin cùng mã nhưng khác nội dung. Đã dừng để bảo vệ dữ liệu.', 'FILE_DATABASE_UNSUPPORTED' => 'Định dạng dữ liệu trong file này chưa được hỗ trợ.'];
            $code = preg_match('/^(FILE_|PC_)[A-Z0-9_]+$/', $e->getMessage()) ? $e->getMessage() : 'FILE_PROCESS_FAILED';
            $this->update($owner, ['state' => 'paused', 'retry' => null, 'error' => $messages[$code] ?? 'Chưa hoàn tất đợt nhập ('.$code.'). Phần đã lưu được giữ lại.', 'errorCode' => $code]);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
