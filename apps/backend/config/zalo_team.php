<?php

return [
    'campaign_worker' => (bool) env('ZALO_TEAM_CAMPAIGN_WORKER', false),
    'campaign_path' => env('ZALO_TEAM_CAMPAIGN_PATH', dirname(env('ZALO_TEAM_ARCHIVE_PATH', storage_path('app/private/zalo-archive'))).'/campaigns'),
    'storage_owner' => env('ZALO_TEAM_STORAGE_OWNER'),
    'runtime' => env('ZALO_TEAM_RUNTIME', 'combined'),
    'remote_api_url' => env('ZALO_TEAM_REMOTE_API_URL'),
    'maintenance' => (bool) env('ZALO_TEAM_MAINTENANCE', false),
    'metrics_path' => env('ZALO_TEAM_METRICS_PATH', '/run/zalo-metrics/server.json'),
    'crm_api_url' => env('ZALO_TEAM_CRM_API_URL'),
    'public_origin' => env('ZALO_TEAM_PUBLIC_ORIGIN', 'http://localhost:3000'),
    'service_key_file' => env('ZALO_TEAM_SERVICE_KEY_FILE'),
    'pc_install' => env('ZALO_TEAM_PC_INSTALL', 'C:/Users/Admin/AppData/Local/Programs/Zalo/Zalo-26.9.10'),
    'pc_media_root' => env('ZALO_TEAM_PC_MEDIA_ROOT', 'D:/Zalo Data'),
    // This CRM installation is single-workspace; do not derive this from a user ID.
    'workspace' => env('ZALO_TEAM_WORKSPACE', 'crm'),
    'archive_path' => env('ZALO_TEAM_ARCHIVE_PATH', storage_path('app/private/zalo-archive')),
    'backup_path' => env('ZALO_TEAM_BACKUP_PATH', storage_path('app/private/zalo-backups')),
    'backup_password' => env('ZALO_TEAM_BACKUP_PASSWORD', env('APP_KEY')),
    'archive_max_file_bytes' => (int) env('ZALO_TEAM_ARCHIVE_MAX_FILE_BYTES', 262144000),
    'drive' => [
        'enabled' => (bool) env('ZALO_TEAM_DRIVE_ENABLED', false),
        // JSON service-account key, mounted read-only. Never include it in backups.
        'credentials_file' => env('ZALO_TEAM_DRIVE_CREDENTIALS_FILE'),
        'shared_drive_id' => env('ZALO_TEAM_DRIVE_SHARED_ID'),
        'folder_id' => env('ZALO_TEAM_DRIVE_FOLDER_ID'),
        'cache_bytes' => (int) env('ZALO_TEAM_DRIVE_CACHE_BYTES', 5368709120),
        // Enable only after a real upload/download/restore acceptance test.
        'evict' => (bool) env('ZALO_TEAM_DRIVE_EVICT', false),
        'excluded_accounts' => array_values(array_filter(explode(',', (string) env('ZALO_TEAM_DRIVE_EXCLUDED_ACCOUNTS', '')), fn ($v) => $v !== '')),
        'backups_after' => env('ZALO_TEAM_DRIVE_BACKUPS_AFTER'),
    ],
    'connector_url' => env('ZALO_TEAM_CONNECTOR_URL', 'http://127.0.0.1:9250'),
    'connector_token_file' => env('ZALO_TEAM_TOKEN_FILE', PHP_OS_FAMILY === 'Windows' ? base_path('../../tooling/zalo-team/.local/web-token') : '/run/secrets/zalo_team_web_token'),
];
