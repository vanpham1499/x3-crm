<?php

$databaseProfile = strtolower((string) env('DB_PROFILE', 'default'));

if (! in_array($databaseProfile, ['default', 'local', 'server'], true)) {
    throw new InvalidArgumentException(
        sprintf('DB_PROFILE must be one of: default, local, server. [%s] given.', $databaseProfile)
    );
}

$databaseValue = static function (string $key, mixed $default = null) use ($databaseProfile): mixed {
    if ($databaseProfile === 'default') {
        return env("DB_{$key}", $default);
    }

    $profileKey = sprintf('DB_%s_%s', strtoupper($databaseProfile), $key);

    return env($profileKey, env("DB_{$key}", $default));
};

return [
    'default' => env('DB_CONNECTION', 'pgsql'),
    'connections' => [
        'pgsql' => [
            'driver' => 'pgsql',
            'url' => $databaseValue('USE_URL', false)
                ? $databaseValue('URL', env('DATABASE_URL'))
                : null,
            'host' => $databaseValue('HOST', '127.0.0.1'),
            'port' => $databaseValue('PORT', '5432'),
            'database' => $databaseValue('DATABASE', 'x3crm'),
            'username' => $databaseValue('USERNAME', 'x3crm'),
            'password' => $databaseValue('PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ],
    ],
    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => true,
    ],
];
