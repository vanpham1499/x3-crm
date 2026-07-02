<?php

return [
    'secret' => env('JWT_SECRET', env('APP_KEY', 'change-me')),
    'ttl' => (int) env('JWT_TTL', 86400),
];
