<?php
// Cold HTTP boot: deliberately do NOT resolve/bootstrap the console kernel first.
$role = $argv[1] ?? 'combined';
putenv('ZALO_TEAM_RUNTIME='.$role);
putenv('SESSION_DRIVER=array');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
set_exception_handler(function (Throwable $e) {
    fwrite(STDERR, get_class($e).': '.$e->getMessage()."\n");
    exit(1);
});
if ($app->bound('config')) { throw new RuntimeException('Test must begin before config loads'); }
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$checks = 1;
function probe(string $path, int $expected, string $method = 'GET', bool $frontend = false): void
{
    global $kernel, $checks;
    $request = Illuminate\Http\Request::create($path, $method);
    $request->headers->set('Accept', 'application/json');
    if ($frontend) {
        $request->headers->set('Origin', 'http://localhost:3000');
        $request->headers->set('Referer', 'http://localhost:3000/');
    }
    $response = $kernel->handle($request);
    if ($response->getStatusCode() !== $expected) {
        throw new RuntimeException($method.' '.$path.' expected '.$expected.', got '.$response->getStatusCode());
    }
    $checks++;
}
if ($role === 'zalo') {
    probe('/api/health', 200);
    probe('/api/auth/me', 404);
    probe('/api/zalo-team/workspace', 404, 'POST', true);
    $key = tempnam(sys_get_temp_dir(), 'zt-http-');
    file_put_contents($key, str_repeat('a', 64));
    config(['zalo_team.service_key_file' => $key]);
    try { probe('/api/zalo-team/archive', 403, 'POST', true); }
    finally { unlink($key); }
} else {
    probe('/api', 200);
    probe('/api/auth/me', 401, 'GET', true);
    probe('/sanctum/csrf-cookie', 204, 'GET', true);
    probe('/api/auth/login', 419, 'POST', true);
    probe('/api/zalo-team/workspace', 401, 'POST');
    probe('/api/zalo-team/workspace', 419, 'POST', true);
}
echo "$checks cold HTTP bootstrap checks passed ($role)\n";
