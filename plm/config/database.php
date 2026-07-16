<?php

declare(strict_types=1);

/**
 * Database connection configuration.
 *
 * The installer writes credentials into config/database.local.php which is
 * merged over these defaults. Never commit real credentials to source control.
 */

$local = __DIR__ . '/database.local.php';

$defaults = [
    'driver'   => 'mysql',
    'host'     => '127.0.0.1',
    'port'     => 3306,
    'database' => 'plm',
    'username' => 'root',
    'password' => '',
    'charset'  => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'options'  => [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_STRINGIFY_FETCHES  => false,
        PDO::ATTR_PERSISTENT         => false,
    ],
];

if (is_readable($local)) {
    /** @var array<string, mixed> $override */
    $override = require $local;
    return array_replace($defaults, $override);
}

return $defaults;
