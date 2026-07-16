<?php

declare(strict_types=1);

/**
 * Installer entry redirect.
 *
 * The installation wizard is served by the application front controller at
 * the /install route. This file simply forwards visitors who navigate to the
 * legacy /installer/ path to the correct location.
 */

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? 'localhost';

header('Location: ' . $scheme . '://' . $host . '/install', true, 302);
echo 'Redirecting to the installation wizard… <a href="/install">/install</a>';
