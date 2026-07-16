<?php

declare(strict_types=1);

/**
 * Application configuration.
 *
 * Values here are overridden at runtime by settings stored in the database
 * where applicable. This file provides framework-level defaults and paths.
 */

return [
    'app' => [
        'name'      => 'Prima License Manager',
        'short'     => 'PLM',
        'version'   => '1.0.0',
        'env'       => getenv('PLM_ENV') ?: 'production',
        'debug'     => filter_var(getenv('PLM_DEBUG') ?: 'false', FILTER_VALIDATE_BOOL),
        'url'       => rtrim(getenv('PLM_URL') ?: '', '/'),
        'timezone'  => 'UTC',
        'locale'    => 'en',
        'installed' => file_exists(dirname(__DIR__) . '/storage/installed.lock'),
    ],

    'security' => [
        'session_name'       => 'PLM_SESSION',
        'session_lifetime'   => 7200,      // seconds
        'cookie_secure'      => true,
        'cookie_httponly'    => true,
        'cookie_samesite'    => 'Strict',
        'csrf_token_name'    => 'plm_csrf',
        'password_algo'      => PASSWORD_ARGON2ID,
        'password_options'   => ['memory_cost' => 65536, 'time_cost' => 4, 'threads' => 2],
        'max_login_attempts' => 5,
        'lockout_time'       => 900,       // seconds
        'rate_limit'         => 120,       // requests per minute per IP for API
    ],

    'paths' => [
        'root'      => dirname(__DIR__),
        'app'       => dirname(__DIR__) . '/app',
        'views'     => dirname(__DIR__) . '/app/Views',
        'storage'   => dirname(__DIR__) . '/storage',
        'logs'      => dirname(__DIR__) . '/storage/logs',
        'uploads'   => dirname(__DIR__) . '/storage/uploads',
        'temp'      => dirname(__DIR__) . '/storage/temp',
        'backups'   => dirname(__DIR__) . '/storage/backups',
        'keys'      => dirname(__DIR__) . '/storage/keys',
        'public'    => dirname(__DIR__) . '/public',
    ],

    'license' => [
        'key_segments'     => 5,
        'segment_length'   => 5,
        'signature_algo'   => OPENSSL_ALGO_SHA256,
        'rsa_bits'         => 4096,
        'cipher'           => 'aes-256-cbc',
        'file_magic'       => 'PLMLIC01',
        'default_grace'    => 3,           // days grace after expiry
        'expiring_window'  => 30,          // days considered "expiring soon"
    ],

    'api' => [
        'prefix'      => '/api/v1',
        'token_ttl'   => 3600,             // JWT lifetime in seconds
        'header'      => 'X-API-Key',
    ],
];
