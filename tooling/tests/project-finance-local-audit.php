<?php

// Read-only audit with an explicit guard against the shared production database.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
if (config('database.default') !== 'pgsql'
    || config('database.connections.pgsql.host') !== '127.0.0.1'
    || (string) config('database.connections.pgsql.port') !== '5433') {
    throw new RuntimeException('Local database only: 127.0.0.1:5433');
}
$result = $kernel->call('finance:audit-topup');
echo $kernel->output();
exit($result);
