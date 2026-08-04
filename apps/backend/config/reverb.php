<?php

$allowedOrigins = array_values(array_filter(array_map(
    'trim',
    explode(',', env('REVERB_ALLOWED_ORIGINS', env('FRONTEND_URLS', env('FRONTEND_URL', 'http://localhost:3000')))),
)));

return [
    'default' => env('REVERB_SERVER', 'reverb'),

    'servers' => [
        'reverb' => [
            'host' => env('REVERB_SERVER_HOST', '0.0.0.0'),
            'port' => (int) env('REVERB_SERVER_PORT', 8080),
            'path' => env('REVERB_SERVER_PATH', ''),
            'hostname' => env('REVERB_SERVER_HOSTNAME'),
            'options' => ['tls' => []],
            'max_request_size' => (int) env('REVERB_MAX_REQUEST_SIZE', 10_000),
            'scaling' => [
                'enabled' => false,
                'channel' => 'reverb',
                'server' => [
                    'url' => null,
                    'host' => '127.0.0.1',
                    'port' => 6379,
                    'username' => null,
                    'password' => null,
                    'database' => 0,
                    'timeout' => 60,
                ],
            ],
            'pulse_ingest_interval' => 15,
            'telescope_ingest_interval' => 15,
        ],
    ],

    'apps' => [
        'provider' => 'config',
        'apps' => [
            [
                'key' => env('REVERB_APP_KEY'),
                'secret' => env('REVERB_APP_SECRET'),
                'app_id' => env('REVERB_APP_ID'),
                'options' => [
                    'host' => env('REVERB_HOST', '127.0.0.1'),
                    'port' => (int) env('REVERB_PORT', 8080),
                    'scheme' => env('REVERB_SCHEME', 'http'),
                    'useTLS' => env('REVERB_SCHEME', 'http') === 'https',
                ],
                'allowed_origins' => $allowedOrigins,
                'ping_interval' => 60,
                'activity_timeout' => 30,
                'max_connections' => env('REVERB_APP_MAX_CONNECTIONS'),
                'max_message_size' => 10_000,
                'accept_client_events_from' => 'members',
                'rate_limiting' => [
                    'enabled' => false,
                    'max_attempts' => 60,
                    'decay_seconds' => 60,
                    'terminate_on_limit' => false,
                ],
            ],
        ],
    ],
];
